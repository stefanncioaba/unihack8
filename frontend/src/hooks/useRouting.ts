// TanStack Query hook for the route planner (Map tab directions, PLAN 14.5).
import { useQuery } from '@tanstack/react-query';

import { planRoute } from '@/api/endpoints.routing';
import type { PlanMode } from '@/api/types.routing';
import { toNearParam, type Coordinates } from '@/lib/geo';

/** Cache keys for route plans (positions rounded to ~1 m by `toNearParam`). */
export const routingKeys = {
  plan: (from: string, to: string, mode: PlanMode) => ['routes', 'plan', from, to, mode] as const,
};

/** The fastest route from `from` to `to` by `mode`; off when there is no destination. Cached for a minute. */
export function useRoutePlan(from: Coordinates, to: Coordinates | null, mode: PlanMode) {
  const fromParam = toNearParam(from);
  const toParam = to ? toNearParam(to) : '';
  return useQuery({
    queryKey: routingKeys.plan(fromParam, toParam, mode),
    queryFn: () => planRoute(fromParam, toParam, mode),
    enabled: !!to,
    staleTime: 60_000,
    retry: false,
  });
}
