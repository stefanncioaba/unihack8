// Mock routes: route planner (docs/API.md -> Routing, GET /routes/plan). Straight lines instead of streets:
// walking at 80 m/min on 1.3x the straight distance; TRANSIT = walk to the nearest stop, ride, walk from the stop
// nearest the destination. Short trips (or the same stop at both ends) answer the walking route with mode WALK.
// A destination more than 50 km from the centre makes TRANSIT answer 503 SOURCE_UNAVAILABLE (to test that state).
import { ApiError } from '@/api/errors';
import type { LegMode, PlanMode, RouteLeg, RoutePlan } from '@/api/types.routing';
import type { TransitStop } from '@/api/types.transit';
import { DEFAULT_POSITION, distanceMeters, isValidCoordinate, type Coordinates } from '@/lib/geo';
import { encodePolyline } from '@/lib/polyline';

import type { Route } from '../core';
import { LINE_STOPS, MOCK_ROUTES, MOCK_STOPS } from '../transitSeed';

const WALK_M_PER_MIN = 80;
const RIDE_M_PER_MIN = 300;
const WALK_DETOUR = 1.3;
/** Below this straight distance a TRANSIT request answers the walking route. */
const MIN_TRANSIT_METERS = 900;

/** Parses `lat,lon` or throws 400 VALIDATION_FAILED. */
function point(raw: unknown, name: string): Coordinates {
  const [lat, lon] = String(raw ?? '').split(',').map(Number);
  if (String(raw ?? '').split(',').length !== 2 || !isValidCoordinate(lat, lon)) {
    throw new ApiError(400, 'VALIDATION_FAILED', `Malformed ${name}`, { [name]: 'must be lat,lon' });
  }
  return { lat, lon };
}

/** The stop closest to a point. */
function nearestStop(p: Coordinates): TransitStop {
  return MOCK_STOPS.reduce((best, s) => (distanceMeters(p, s) < distanceMeters(p, best) ? s : best));
}

/** One leg between two named points, starting at `startMs`. */
function leg(mode: LegMode, from: Coordinates & { name: string }, to: Coordinates & { name: string }, startMs: number, minutes: number, route: string | null = null, headsign: string | null = null): RouteLeg {
  return {
    mode,
    route,
    headsign,
    from: { name: from.name, lat: from.lat, lon: from.lon },
    to: { name: to.name, lat: to.lat, lon: to.lon },
    startsAt: new Date(startMs).toISOString(),
    endsAt: new Date(startMs + minutes * 60_000).toISOString(),
    durationMinutes: minutes,
    polyline: encodePolyline([from, to]),
  };
}

/** Builds the answer from its legs (total duration and distance). */
function plan(mode: PlanMode, legs: RouteLeg[], distance: number): RoutePlan {
  // The mock builds every leg with times, so these are never null here.
  const startsAt = legs[0].startsAt as string;
  const endsAt = legs[legs.length - 1].endsAt as string;
  return {
    mode,
    durationMinutes: Math.round((Date.parse(endsAt) - Date.parse(startsAt)) / 60_000),
    distanceMeters: Math.round(distance),
    startsAt,
    endsAt,
    fallback: false,
    legs,
  };
}

/** Walking only. */
function walkPlan(from: Coordinates, to: Coordinates, now: number): RoutePlan {
  const meters = distanceMeters(from, to) * WALK_DETOUR;
  const minutes = Math.max(1, Math.round(meters / WALK_M_PER_MIN));
  return plan('WALK', [leg('WALK', { ...from, name: 'Start' }, { ...to, name: 'Destination' }, now, minutes)], meters);
}

/** Walk → ride → walk, or the walking plan when transit does not help. */
function transitPlan(from: Coordinates, to: Coordinates, now: number): RoutePlan {
  if (distanceMeters(DEFAULT_POSITION, to) > 50_000) throw new ApiError(503, 'SOURCE_UNAVAILABLE', 'Route planner unavailable');
  const a = nearestStop(from);
  const b = nearestStop(to);
  if (distanceMeters(from, to) < MIN_TRANSIT_METERS || a.id === b.id) return walkPlan(from, to, now);

  const line = a.routes.find((r) => b.routes.includes(r)) ?? a.routes[0];
  const info = MOCK_ROUTES.find((r) => r.id === line)!;
  const order = LINE_STOPS[line];
  const headsign = (order.indexOf(a.id) <= order.indexOf(b.id) ? info.to : info.from) ?? '';
  const legMode: LegMode = info.type === 'TRAM' ? 'TRAM' : info.type === 'TROLLEYBUS' ? 'TROLLEYBUS' : 'BUS';

  const walk1 = distanceMeters(from, a) * WALK_DETOUR;
  const ride = distanceMeters(a, b);
  const walk2 = distanceMeters(b, to) * WALK_DETOUR;
  const m1 = Math.max(1, Math.round(walk1 / WALK_M_PER_MIN));
  const m2 = Math.max(1, Math.round(ride / RIDE_M_PER_MIN));
  const m3 = Math.max(1, Math.round(walk2 / WALK_M_PER_MIN));
  const wait = 3;

  const t1 = now;
  const t2 = t1 + (m1 + wait) * 60_000;
  const t3 = t2 + m2 * 60_000;
  const legs = [
    leg('WALK', { ...from, name: 'Start' }, a, t1, m1),
    leg(legMode, a, b, t2, m2, line, headsign),
    leg('WALK', b, { ...to, name: 'Destination' }, t3, m3),
  ];
  const result = plan('TRANSIT', legs, walk1 + ride + walk2);
  // Riding only helps if it beats walking; otherwise OTP would answer the walking route too.
  const walking = walkPlan(from, to, now);
  return walking.durationMinutes <= result.durationMinutes ? walking : result;
}

export const routingRoutes: Route[] = [
  {
    method: 'GET',
    pattern: /^\/routes\/plan$/,
    handler: ({ query }): RoutePlan => {
      const from = point(query.from, 'from');
      const to = point(query.to, 'to');
      const mode = String(query.mode ?? 'WALK');
      if (mode !== 'WALK' && mode !== 'TRANSIT') {
        throw new ApiError(400, 'VALIDATION_FAILED', 'Unknown mode', { mode: 'must be WALK or TRANSIT' });
      }
      const now = Date.now();
      return mode === 'WALK' ? walkPlan(from, to, now) : transitPlan(from, to, now);
    },
  },
];
