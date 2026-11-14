// TanStack Query hook for the Neighbourhood Pulse screen.
import { useQuery } from '@tanstack/react-query';

import { getNeighbourhoodPulse } from '@/api/endpoints.neighbourhoods';

/** The pulse refreshes this often while the screen is open (the backend caches it for 30 s). */
export const PULSE_REFRESH_MS = 60_000;

export const neighbourhoodKeys = { pulse: ['neighbourhoods', 'pulse'] as const };

/** Every area's live card, refreshed every minute. */
export function useNeighbourhoodPulse() {
  return useQuery({ queryKey: neighbourhoodKeys.pulse, queryFn: getNeighbourhoodPulse, refetchInterval: PULSE_REFRESH_MS });
}
