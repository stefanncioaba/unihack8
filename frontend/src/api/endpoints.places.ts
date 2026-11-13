// Typed wrappers around the places endpoints (docs/API.md -> Places). Screens call these through hooks/usePlaces.ts.
import { api } from './client';
import type { Paged } from './types';
import type { PlaceDetail, PlaceQuery, PlaceSummary } from './types.places';

/** Places filtered by category, visible area (`bbox`), distance or name. */
export const listPlaces = (query: PlaceQuery, signal?: AbortSignal) =>
  api<Paged<PlaceSummary>>('GET', '/places', { query: query as Record<string, never>, signal });

/** One place with opening hours and useful OSM tags. */
export const getPlace = (id: string) => api<PlaceDetail>('GET', `/places/${id}`);
