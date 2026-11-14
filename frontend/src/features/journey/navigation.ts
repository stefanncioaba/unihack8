// How an AI route card opens the Map tab (PLAN 18.4, 18.5): the route travels as plain route params, so the map
// can be opened from any tab. `go=1` starts a journey, otherwise the route is only previewed in the directions panel.
import type { ChatRoute } from '@/api/types.ai';
import type { PlanMode } from '@/api/types.routing';
import { isValidCoordinate, type Coordinates } from '@/lib/geo';

/** A route as the Map tab receives it. */
export type RouteRequest = {
  go: boolean;
  from: Coordinates;
  fromName: string | null;
  to: Coordinates;
  toName: string | null;
  mode: PlanMode;
};

/** Route params for the Map tab. `at` makes pressing the same button twice a new request. */
export function routeParams(route: ChatRoute, go: boolean, now = Date.now()): Record<string, string> {
  return {
    route: go ? 'go' : 'preview',
    fromLat: String(route.from.lat),
    fromLon: String(route.from.lon),
    fromName: route.from.name ?? '',
    toLat: String(route.to.lat),
    toLon: String(route.to.lon),
    toName: route.to.name ?? '',
    mode: route.mode,
    at: String(now),
  };
}

/** Reads the params back; null when there is no route request or it is malformed. */
export function parseRouteParams(params: Record<string, string | string[] | undefined>): RouteRequest | null {
  const text = (key: string) => {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };
  const kind = text('route');
  if (kind !== 'go' && kind !== 'preview') return null;
  const from = { lat: Number(text('fromLat')), lon: Number(text('fromLon')) };
  const to = { lat: Number(text('toLat')), lon: Number(text('toLon')) };
  if (!isValidCoordinate(to.lat, to.lon) || !isValidCoordinate(from.lat, from.lon)) return null;
  return {
    go: kind === 'go',
    from,
    fromName: text('fromName') || null,
    to,
    toName: text('toName') || null,
    mode: text('mode') === 'WALK' ? 'WALK' : 'TRANSIT',
  };
}
