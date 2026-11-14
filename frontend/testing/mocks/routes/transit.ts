// Mock routes: transit (STPT). Shapes follow docs/API.md -> Transit.
import { ApiError } from '@/api/errors';
import type { LastDepartures, StopArrivals, TransitArrival, TransitShape, TransitStop, TransitSummary, TransitVehicles } from '@/api/types.transit';
import { encodePolyline } from '@/lib/polyline';
import { bucharestToUtcIso, toBucharest } from '@/lib/time';

import { getState, type Route } from '../core';
import { LINE_STOPS, LINES_NOT_RUNNING, MOCK_ROUTES, MOCK_STOPS } from '../transitSeed';

/** Small stable number from a string (so mock times look varied but repeatable). */
function hash(s: string): number {
  let h = 7;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) % 9973;
  return h;
}

/** Finds a stop or throws 404. */
function stopById(id: string): TransitStop {
  const stop = MOCK_STOPS.find((s) => s.id === id);
  if (!stop) throw new ApiError(404, 'NOT_FOUND', 'Stop not found');
  return stop;
}

/** The far end of a line, seen from a stop: where a vehicle passing there is heading. */
function headsignFrom(route: string, stopId: string): string {
  const line = MOCK_ROUTES.find((r) => r.id === route)!;
  const order = LINE_STOPS[route];
  return order.indexOf(stopId) < order.length - 1 ? (line.to ?? '') : (line.from ?? '');
}

/** Parses `minLon,minLat,maxLon,maxLat` or throws 400. */
function parseBbox(raw: unknown): number[] {
  const b = String(raw).split(',').map(Number);
  if (b.length !== 4 || b.some((n) => !Number.isFinite(n))) {
    throw new ApiError(400, 'VALIDATION_FAILED', 'Malformed bbox', { bbox: 'is malformed' });
  }
  return b;
}

/** Two vehicles per running line, sliding between consecutive stops as time passes. */
function vehiclesFor(route: string, now: number): TransitVehicles['vehicles'] {
  if (LINES_NOT_RUNNING.includes(route)) return [];
  const line = MOCK_ROUTES.find((r) => r.id === route)!;
  const order = LINE_STOPS[route].map(stopById);
  const t = now / 120_000;
  return [0, 0.5].map((offset, i) => {
    const pos = ((t / order.length + offset) % 1) * (order.length - 1);
    const a = order[Math.floor(pos)];
    const b = order[Math.min(order.length - 1, Math.floor(pos) + 1)];
    const f = pos - Math.floor(pos);
    return {
      id: `${route}-${100 + i}`,
      route,
      routeName: line.name,
      type: line.type,
      color: line.color,
      lat: a.lat + (b.lat - a.lat) * f,
      lon: a.lon + (b.lon - a.lon) * f,
      bearing: null,
      speedKmh: 18,
      headsign: headsignFrom(route, a.id),
      nextStop: b.name,
      accessible: i === 0,
      reportedAt: new Date(now - 4000).toISOString(),
    };
  });
}

export const transitRoutes: Route[] = [
  {
    method: 'GET',
    pattern: /^\/transit\/summary$/,
    handler: (): TransitSummary => ({
      nearestStop: { id: '1', name: 'Dâmbovița (Ion Barac)', distanceMeters: 230 },
      nextArrival: { route: '2', headsign: 'Shopping City', arrivesAt: '2026-11-14T19:45:00Z', minutes: 4, live: true, last: false },
      lastDepartures: [{ route: '2', headsign: 'Shopping City', lastDepartureAt: '2026-11-14T21:41:00Z' }],
      activeAlerts: getState().alerts.length,
      message: 'Next tram 2 at Dâmbovița (Ion Barac) arrives at 21:45 (in 4 min)',
    }),
  },
  { method: 'GET', pattern: /^\/transit\/alerts$/, handler: () => getState().alerts },
  { method: 'GET', pattern: /^\/transit\/routes$/, handler: () => MOCK_ROUTES },
  {
    method: 'GET',
    pattern: /^\/transit\/stops$/,
    handler: ({ query }): TransitStop[] => {
      if (query.bbox === undefined || query.bbox === '') return MOCK_STOPS;
      const [minLon, minLat, maxLon, maxLat] = parseBbox(query.bbox);
      return MOCK_STOPS.filter((s) => s.lon >= minLon && s.lon <= maxLon && s.lat >= minLat && s.lat <= maxLat);
    },
  },
  {
    method: 'GET',
    pattern: /^\/transit\/vehicles$/,
    handler: ({ query }): TransitVehicles => {
      const now = Date.now();
      // No `route`: every live vehicle of every line in one answer.
      if (query.route === undefined || query.route === '') {
        return { route: null, updatedAt: new Date(now).toISOString(), stale: false, vehicles: MOCK_ROUTES.flatMap((r) => vehiclesFor(r.id, now)) };
      }
      const route = String(query.route);
      if (!LINE_STOPS[route]) throw new ApiError(404, 'NOT_FOUND', 'Line not found');
      return { route, updatedAt: new Date(now).toISOString(), stale: false, vehicles: vehiclesFor(route, now) };
    },
  },
  {
    method: 'GET',
    pattern: /^\/transit\/shapes$/,
    handler: ({ query }): TransitShape[] => {
      // Straight lines through each line's stops (both directions run the same stops, so one polyline per line).
      const wanted = query.route === undefined || query.route === '' ? null : String(query.route).toUpperCase();
      return MOCK_ROUTES.filter((r) => !wanted || r.id.toUpperCase() === wanted).map((r) => ({
        route: r.id,
        routeName: r.name,
        type: r.type,
        color: r.color,
        polylines: [encodePolyline(LINE_STOPS[r.id].map((id) => stopById(id)))],
      }));
    },
  },
  {
    method: 'GET',
    pattern: /^\/transit\/stops\/([^/]+)\/arrivals$/,
    handler: ({ params }): StopArrivals => {
      const stop = stopById(params[0]);
      const now = Date.now();
      const arrivals: TransitArrival[] = stop.routes
        .filter((r) => !LINES_NOT_RUNNING.includes(r))
        .flatMap((r) => {
          const first = 1 + (hash(stop.id + r) % 9);
          return [first, first + 12].map((minutes, i) => ({
            route: r,
            headsign: headsignFrom(r, stop.id),
            arrivesAt: new Date(now + minutes * 60_000).toISOString(),
            minutes,
            live: i === 0,
          }));
        })
        .sort((a, b) => a.minutes - b.minutes);
      return { stopId: stop.id, stopName: stop.name, updatedAt: new Date(now).toISOString(), stale: false, arrivals };
    },
  },
  {
    method: 'GET',
    pattern: /^\/transit\/last-departures$/,
    handler: ({ query }): LastDepartures => {
      const stop = stopById(String(query.stopId ?? ''));
      const today = toBucharest(Date.now());
      const departures = stop.routes.map((r) => ({
        route: r,
        headsign: headsignFrom(r, stop.id),
        lastDepartureAt: bucharestToUtcIso({
          year: today.year,
          month: today.month,
          day: today.day,
          hour: 22 + (hash(stop.id + r) % 2),
          minute: hash(r + stop.id) % 60,
        }),
      }));
      return { stopId: stop.id, stopName: stop.name, source: 'TIMETABLE', departures };
    },
  },
];
