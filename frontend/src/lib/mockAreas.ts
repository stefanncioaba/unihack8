// Per-area mock switch. `EXPO_PUBLIC_USE_MOCKS` can be `true` (everything mocked), `false`/empty (nothing mocked)
// or a comma-separated list of areas, e.g. `ai,events`. An area is the first segment of the API path:
// events, users, places, transit, routes, ai. This lets each developer try the real backend for their own
// part while the rest stays on mocks (PLAN 17.1).

export type MockAreas = 'all' | string[];

/** Reads the raw env value into "all", or a list of area names (empty list = nothing mocked). */
export function parseMockAreas(raw: string | undefined): MockAreas {
  const value = (raw ?? '').trim().toLowerCase();
  if (value === 'true' || value === 'all') return 'all';
  if (value === '' || value === 'false') return [];
  return value
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

/** The area of an API path: `/events/123/join` -> `events`. */
export function areaOf(path: string): string {
  return path.replace(/^\/+/, '').split(/[/?]/)[0].toLowerCase();
}

/** True when this request should be answered by `src/mocks/` instead of the backend. */
export function isMockedPath(areas: MockAreas, path: string): boolean {
  return areas === 'all' || areas.includes(areaOf(path));
}
