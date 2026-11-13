// Mock routes: places (docs/API.md -> Places). Same filters and errors as the real endpoint.
import { ApiError } from '@/api/errors';
import type { Paged } from '@/api/types';
import { PLACE_CATEGORIES, type PlaceDetail, type PlaceSummary } from '@/api/types.places';

import { asList, asNumber, type Route } from '../core';
import { seedPlaces } from '../placesSeed';

const PLACES = seedPlaces();
const EARTH_RADIUS_M = 6_371_000;

/** Straight-line distance in metres (haversine). */
function distance(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(rad(bLat - aLat) / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(rad(bLon - aLon) / 2) ** 2;
  return Math.round(2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h)));
}

/** Parses `a,b[,c,d]` into numbers or throws 400. */
function numbers(raw: unknown, count: number, name: string): number[] {
  const parts = String(raw).split(',').map(Number);
  if (parts.length !== count || parts.some((n) => !Number.isFinite(n))) {
    throw new ApiError(400, 'VALIDATION_FAILED', `Malformed ${name}`, { [name]: 'is malformed' });
  }
  return parts;
}

/** Summary shape of a place (distance only when `near` was given). */
function summary(p: PlaceDetail, distanceMeters: number | null): PlaceSummary {
  return { id: p.id, osmId: p.osmId, name: p.name, category: p.category, lat: p.lat, lon: p.lon, address: p.address, distanceMeters };
}

export const placesRoutes: Route[] = [
  {
    method: 'GET',
    pattern: /^\/places$/,
    handler: ({ query }): Paged<PlaceSummary> => {
      const categories = asList(query.category);
      const bad = categories.find((c) => !PLACE_CATEGORIES.includes(c as never));
      if (bad) throw new ApiError(400, 'VALIDATION_FAILED', `Unknown category "${bad}". Valid: ${PLACE_CATEGORIES.join(', ')}`);
      if (query.radius !== undefined && query.near === undefined) throw new ApiError(400, 'VALIDATION_FAILED', 'radius needs near');

      let list = PLACES.map((p) => ({ p, d: null as number | null }));
      if (categories.length) list = list.filter(({ p }) => categories.includes(p.category));
      if (query.bbox) {
        const [minLon, minLat, maxLon, maxLat] = numbers(query.bbox, 4, 'bbox');
        list = list.filter(({ p }) => p.lon >= minLon && p.lon <= maxLon && p.lat >= minLat && p.lat <= maxLat);
      }
      const q = String(query.q ?? '').trim().toLowerCase();
      if (q) list = list.filter(({ p }) => p.name.toLowerCase().includes(q));
      if (query.near) {
        const [lat, lon] = numbers(query.near, 2, 'near');
        const radius = Math.min(10_000, asNumber(query.radius, 1500));
        list = list
          .map(({ p }) => ({ p, d: distance(lat, lon, p.lat, p.lon) as number | null }))
          .filter(({ d }) => (d as number) <= radius)
          .sort((a, b) => (a.d as number) - (b.d as number));
      } else {
        list.sort((a, b) => a.p.name.localeCompare(b.p.name));
      }

      const page = Math.max(0, asNumber(query.page, 0));
      const max = query.bbox ? 500 : 100;
      const size = Math.min(max, Math.max(1, asNumber(query.size, 20)));
      return {
        items: list.slice(page * size, page * size + size).map(({ p, d }) => summary(p, d)),
        page,
        size,
        totalItems: list.length,
        totalPages: Math.ceil(list.length / size),
      };
    },
  },
  {
    method: 'GET',
    pattern: /^\/places\/([^/]+)$/,
    handler: ({ params }): PlaceDetail => {
      const found = PLACES.find((p) => p.id === params[0]);
      if (!found) throw new ApiError(404, 'NOT_FOUND', 'Place not found');
      return found;
    },
  },
];
