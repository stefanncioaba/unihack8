// Mock backend: answers the same requests as the Spring API (docs/API.md) from in-memory data.
// State changes (join, leave, create, ban, check-in, help offers and scans) persist until the app reloads.
// Routes live in `routes/<area>.ts`; this file only assembles them.
import { ApiError } from '@/api/errors';

import { getMockLatency, type Query, type Route } from './core';
import { aiRoutes } from './routes/ai';
import { eventsRoutes } from './routes/events';
import { helpRoutes } from './routes/help';
import { placesRoutes } from './routes/places';
import { neighbourhoodsRoutes } from './routes/neighbourhoods';
import { newsRoutes } from './routes/news';
import { routingRoutes } from './routes/routing';
import { transitRoutes } from './routes/transit';
import { usersRoutes } from './routes/users';

export { MOCK_ME_ID } from './data';
export { getMockLatency, getState as getMockState, resetMocks, setMockLatency } from './core';

// Order matters inside one file (e.g. `/users/me` before `/users/{id}`), not between files.
const routes: Route[] = [...usersRoutes, ...eventsRoutes, ...transitRoutes, ...placesRoutes, ...routingRoutes, ...aiRoutes, ...neighbourhoodsRoutes, ...helpRoutes, ...newsRoutes];

/** Entry point used by the API client when an area is mocked. */
export async function mockRequest(method: string, path: string, query: Query = {}, body?: unknown): Promise<unknown> {
  const latencyMs = getMockLatency();
  if (latencyMs > 0) await new Promise((resolve) => setTimeout(resolve, latencyMs));
  for (const route of routes) {
    if (route.method !== method) continue;
    const match = route.pattern.exec(path);
    if (match) return structuredCloneSafe(route.handler({ params: match.slice(1), query, body }));
  }
  throw new ApiError(404, 'NOT_FOUND', `No mock for ${method} ${path}`);
}

/** Deep copy so screens can never mutate the mock state through a response. */
function structuredCloneSafe<T>(value: T): T {
  return value === undefined ? value : (JSON.parse(JSON.stringify(value)) as T);
}
