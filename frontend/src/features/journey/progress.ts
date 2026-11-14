// Journey maths (PLAN 18.5–18.7), kept free of React so it can be tested with plain positions: which step the user is
// on, how far they are from the route, what is left, and when they have arrived.
import type { RouteLeg, RoutePlan } from '@/api/types.routing';
import { distanceMeters, type Coordinates } from '@/lib/geo';
import { decodePolyline } from '@/lib/polyline';

/** Further than this from the route counts as "off the route" and triggers a re-plan (18.6). */
export const OFF_ROUTE_METERS = 50;
/** Within this of the destination the journey is over (18.6). */
export const ARRIVED_METERS = 30;
/** Within this of a step's end the next step starts. */
export const STEP_DONE_METERS = 25;
/** Moved more than this since the AI answered: the route is planned from the new position (18.7). */
export const MOVED_REPLAN_METERS = 200;

/** Where the user stands on the planned route. */
export type JourneyProgress = {
  /** Index of the current leg in `plan.legs`. */
  stepIndex: number;
  /** Distance from the user to the current and later legs (0 when the route has no geometry). */
  offRouteMeters: number;
  remainingMeters: number;
  remainingMinutes: number;
  arrived: boolean;
};

/** The line of a leg: its polyline, or a straight line between its ends when it has none. */
export function legPoints(leg: RouteLeg): Coordinates[] {
  const points = decodePolyline(leg.polyline);
  if (points.length >= 2) return points;
  return [leg.from, leg.to].filter((p): p is NonNullable<typeof p> => p !== null).map((p) => ({ lat: p.lat, lon: p.lon }));
}

/** Metres east / north of `origin` (flat projection, fine for a city). */
function toLocal(origin: Coordinates, p: Coordinates): { x: number; y: number } {
  const metersPerDegree = 111_320;
  return {
    x: (p.lon - origin.lon) * metersPerDegree * Math.cos((origin.lat * Math.PI) / 180),
    y: (p.lat - origin.lat) * metersPerDegree,
  };
}

/** Distance from `p` to the segment a–b and how far along it (0..1) the closest point is. */
function toSegment(p: Coordinates, a: Coordinates, b: Coordinates): { meters: number; t: number } {
  const B = toLocal(a, b);
  const P = toLocal(a, p);
  const lengthSquared = B.x * B.x + B.y * B.y;
  const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, (P.x * B.x + P.y * B.y) / lengthSquared));
  return { meters: Math.hypot(P.x - t * B.x, P.y - t * B.y), t };
}

/** Length of a line in metres. */
export function lineLength(points: Coordinates[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += distanceMeters(points[i - 1], points[i]);
  return total;
}

/** Closest approach of `p` to a line, and the metres of the line still ahead of that point. */
export function nearestOnLine(p: Coordinates, points: Coordinates[]): { meters: number; metersAhead: number } {
  if (points.length === 0) return { meters: Infinity, metersAhead: 0 };
  if (points.length === 1) return { meters: distanceMeters(p, points[0]), metersAhead: 0 };
  let best = { meters: Infinity, segment: 0, t: 0 };
  for (let i = 1; i < points.length; i++) {
    const s = toSegment(p, points[i - 1], points[i]);
    if (s.meters < best.meters) best = { meters: s.meters, segment: i - 1, t: s.t };
  }
  const segmentLength = distanceMeters(points[best.segment], points[best.segment + 1]);
  const metersAhead = (1 - best.t) * segmentLength + lineLength(points.slice(best.segment + 1));
  return { meters: best.meters, metersAhead };
}

/**
 * Progress along `plan` at `position`. Steps only move forward: the current step is the nearest leg from
 * `currentStep` on, and a step whose end the user has reached hands over to the next one.
 */
export function journeyProgress(plan: RoutePlan, position: Coordinates, currentStep: number, destination: Coordinates): JourneyProgress {
  const legs = plan.legs.map(legPoints);
  const toDestination = distanceMeters(position, destination);
  if (legs.length === 0) {
    return { stepIndex: 0, offRouteMeters: 0, remainingMeters: toDestination, remainingMinutes: plan.durationMinutes, arrived: toDestination <= ARRIVED_METERS };
  }

  let step = Math.min(Math.max(0, currentStep), legs.length - 1);
  let bestMeters = Infinity;
  for (let i = step; i < legs.length; i++) {
    const meters = nearestOnLine(position, legs[i]).meters;
    if (meters < bestMeters) {
      bestMeters = meters;
      step = i;
    }
  }
  // At the end of a step (e.g. at the tram stop), the next step starts.
  while (step < legs.length - 1) {
    const end = legs[step][legs[step].length - 1];
    if (!end || distanceMeters(position, end) > STEP_DONE_METERS) break;
    step += 1;
  }

  const here = nearestOnLine(position, legs[step]);
  const legLength = lineLength(legs[step]);
  const fractionLeft = legLength > 0 ? Math.min(1, here.metersAhead / legLength) : 1;
  let remainingMeters = here.metersAhead;
  let remainingMinutes = plan.legs[step].durationMinutes * fractionLeft;
  for (let i = step + 1; i < legs.length; i++) {
    remainingMeters += lineLength(legs[i]);
    remainingMinutes += plan.legs[i].durationMinutes;
  }

  return {
    stepIndex: step,
    offRouteMeters: Number.isFinite(bestMeters) ? Math.min(bestMeters, here.meters) : 0,
    remainingMeters: Math.round(remainingMeters),
    remainingMinutes: Math.max(remainingMeters > 0 ? 1 : 0, Math.ceil(remainingMinutes)),
    arrived: toDestination <= ARRIVED_METERS,
  };
}

/** The instruction for a step: "Walk to stop X", "Take tram 1 towards Y, get off at Z", "Walk to <destination>". */
export function stepText(leg: RouteLeg, isLast: boolean, destinationName: string | null): string {
  if (leg.mode === 'WALK') {
    if (isLast) return `Walk to ${destinationName ?? 'your destination'}`;
    return `Walk to stop ${leg.to?.name ?? 'the next stop'}`;
  }
  const kind = leg.mode === 'TRAM' ? 'tram' : leg.mode === 'TROLLEYBUS' ? 'trolleybus' : 'bus';
  const towards = leg.headsign ? ` towards ${leg.headsign}` : '';
  return `Take ${kind} ${leg.route ?? ''}${towards}, get off at ${leg.to?.name ?? 'your stop'}`.replace('  ', ' ');
}
