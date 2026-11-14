// TanStack Query hooks for transit data (STPT): home page line, alerts, and the Map tab's transit layer (14.4).
import { keepPreviousData, useQuery } from '@tanstack/react-query';

import {
  getLastDepartures,
  getStopArrivals,
  getTransitAlerts,
  getTransitRoutes,
  getTransitStops,
  getTransitSummary,
  getTransitVehicles,
} from '@/api/endpoints.transit';
import { bboxParam, type Bbox } from '@/lib/bbox';
import { toNearParam, type Coordinates } from '@/lib/geo';

/** Live vehicle positions refresh this often (docs/API.md: every 10 s). */
export const VEHICLES_REFRESH_MS = 10_000;
/** Stop arrivals refresh this often while the stop panel is open. */
export const ARRIVALS_REFRESH_MS = 30_000;

/** Cache keys for transit queries. */
export const transitKeys = {
  summary: (near: string) => ['transit', 'summary', near] as const,
  alerts: ['transit', 'alerts'] as const,
  routes: ['transit', 'routes'] as const,
  stops: (bbox: string) => ['transit', 'stops', bbox] as const,
  vehicles: (route: string) => ['transit', 'vehicles', route] as const,
  arrivals: (stopId: string) => ['transit', 'arrivals', stopId] as const,
  lastDepartures: (stopId: string) => ['transit', 'last-departures', stopId] as const,
};

/** Home page transit line near a position (shows the next arrival, so refreshed every 30 s). */
export function useTransitSummary(position: Coordinates) {
  const near = toNearParam(position);
  return useQuery({ queryKey: transitKeys.summary(near), queryFn: () => getTransitSummary(near), refetchInterval: ARRIVALS_REFRESH_MS });
}

/** Active service alerts. */
export function useTransitAlerts() {
  return useQuery({ queryKey: transitKeys.alerts, queryFn: getTransitAlerts, refetchInterval: 5 * 60_000 });
}

/** All lines (rarely changes, so cached for an hour). */
export function useTransitRoutes(enabled = true) {
  return useQuery({ queryKey: transitKeys.routes, queryFn: getTransitRoutes, enabled, staleTime: 60 * 60_000 });
}

/** Stops in the visible area. Keeps the old stops while panning. */
export function useStopsInArea(bbox: Bbox | null, enabled: boolean) {
  const param = bbox ? bboxParam(bbox) : '';
  return useQuery({
    queryKey: transitKeys.stops(param),
    queryFn: () => getTransitStops(param),
    enabled: enabled && !!bbox,
    placeholderData: keepPreviousData,
    staleTime: 10 * 60_000,
  });
}

/** Live vehicles of the chosen line, refreshed every 10 s. Off when no line is chosen. */
export function useVehicles(route: string | null) {
  return useQuery({
    queryKey: transitKeys.vehicles(route ?? ''),
    queryFn: () => getTransitVehicles(route!),
    enabled: !!route,
    refetchInterval: VEHICLES_REFRESH_MS,
  });
}

/** Next arrivals at a stop, refreshed every 30 s. */
export function useStopArrivals(stopId: string) {
  return useQuery({ queryKey: transitKeys.arrivals(stopId), queryFn: () => getStopArrivals(stopId), refetchInterval: ARRIVALS_REFRESH_MS });
}

/** Last departure of each line from a stop today. */
export function useLastDepartures(stopId: string) {
  return useQuery({ queryKey: transitKeys.lastDepartures(stopId), queryFn: () => getLastDepartures(stopId), staleTime: 10 * 60_000 });
}
