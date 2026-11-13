// Typed wrapper around the route planner (docs/API.md -> Routing). Screens call it through hooks/useRouting.ts.
import { api } from './client';
import type { PlanMode, RoutePlan } from './types.routing';

/** Fastest route between two `lat,lon` points by walking or walking + public transport. */
export const planRoute = (from: string, to: string, mode: PlanMode) => api<RoutePlan>('GET', '/routes/plan', { query: { from, to, mode } });
