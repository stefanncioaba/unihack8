// Typed wrappers around the transit endpoints (docs/API.md -> Transit). Screens call these through hooks/useTransit.ts.
import { api } from './client';
import type { TransitAlert, TransitSummary } from './types.transit';

/** Home page line: nearest stop and the last departures. */
export const getTransitSummary = (near: string) => api<TransitSummary>('GET', '/transit/summary', { query: { near } });

/** Current service alerts. */
export const getTransitAlerts = () => api<TransitAlert[]>('GET', '/transit/alerts');
