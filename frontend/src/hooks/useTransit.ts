// TanStack Query hooks for transit data (STPT). Owned by the transit/directions work.
import { useQuery } from '@tanstack/react-query';

import { getTransitAlerts, getTransitSummary } from '@/api/endpoints.transit';
import { toNearParam, type Coordinates } from '@/lib/geo';

/** Cache keys for transit queries. */
export const transitKeys = {
  summary: (near: string) => ['transit', 'summary', near] as const,
  alerts: ['transit', 'alerts'] as const,
};

/** Home page transit line near a position. */
export function useTransitSummary(position: Coordinates) {
  const near = toNearParam(position);
  return useQuery({ queryKey: transitKeys.summary(near), queryFn: () => getTransitSummary(near), refetchInterval: 60_000 });
}

/** Active service alerts. */
export function useTransitAlerts() {
  return useQuery({ queryKey: transitKeys.alerts, queryFn: getTransitAlerts, refetchInterval: 5 * 60_000 });
}
