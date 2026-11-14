// Typed wrappers around the transit endpoints (docs/API.md -> Transit). Screens call these through hooks/useTransit.ts.
import { api } from './client';
import type { LastDepartures, StopArrivals, TransitAlert, TransitRoute, TransitShape, TransitStop, TransitSummary, TransitVehicles } from './types.transit';

/** Home page line: nearest stop and the last departures. */
export const getTransitSummary = (near: string) => api<TransitSummary>('GET', '/transit/summary', { query: { near } });

/** Current service alerts. */
export const getTransitAlerts = () => api<TransitAlert[]>('GET', '/transit/alerts');

/** All lines, trams first. */
export const getTransitRoutes = () => api<TransitRoute[]>('GET', '/transit/routes');

/** Stops inside a bbox (`minLon,minLat,maxLon,maxLat`). */
export const getTransitStops = (bbox: string) => api<TransitStop[]>('GET', '/transit/stops', { query: { bbox } });

/** Live vehicles of one line. */
export const getTransitVehicles = (route: string) => api<TransitVehicles>('GET', '/transit/vehicles', { query: { route } });

/** Live vehicles of every line in one answer (`route` is null). */
export const getAllTransitVehicles = () => api<TransitVehicles>('GET', '/transit/vehicles');

/** The drawn path of every line (large and static: fetch once per session). */
export const getTransitShapes = () => api<TransitShape[]>('GET', '/transit/shapes');

/** Next arrivals at a stop. */
export const getStopArrivals = (stopId: string) => api<StopArrivals>('GET', `/transit/stops/${encodeURIComponent(stopId)}/arrivals`);

/** Last departure of each line from a stop today. */
export const getLastDepartures = (stopId: string) => api<LastDepartures>('GET', '/transit/last-departures', { query: { stopId } });
