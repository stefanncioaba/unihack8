// Routing shapes. Source of truth: docs/API.md -> Routing (GET /routes/plan).

/** What the user asks for: walking only, or walking + public transport. */
export type PlanMode = 'WALK' | 'TRANSIT';

/** How one leg is travelled. */
export type LegMode = 'WALK' | 'TRAM' | 'TROLLEYBUS' | 'BUS';

/** A named point at the start or end of a leg. */
export type LegPlace = { name: string; lat: number; lon: number };

/** One leg; `route` and `headsign` are null for walking. `polyline` is a Google encoded polyline. */
export type RouteLeg = {
  mode: LegMode;
  route: string | null;
  headsign: string | null;
  from: LegPlace | null;
  to: LegPlace | null;
  startsAt: string | null;
  endsAt: string | null;
  durationMinutes: number;
  polyline: string | null;
};

/** The route that arrives first. `mode` is what it really uses; `fallback` = straight-line walking estimate. */
export type RoutePlan = {
  mode: PlanMode;
  durationMinutes: number;
  distanceMeters: number;
  startsAt: string;
  endsAt: string;
  fallback: boolean;
  legs: RouteLeg[];
};
