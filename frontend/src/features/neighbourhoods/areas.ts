// Which neighbourhood a point belongs to, with the same rule as the backend (NeighbourhoodAreas.assign):
// the nearest centre whose circle covers the point, so items are never counted in two areas.
import type { Bbox } from '@/lib/bbox';
import { distanceMeters, type Coordinates } from '@/lib/geo';

/** The parts of an area this needs (a NeighbourhoodPulse fits). */
export type AreaCircle = { id: string; lat: number; lon: number; radiusMeters: number };

const EARTH_RADIUS_M = 6_371_000;

/** The id of the area a point belongs to, or null when no circle covers it. */
export function areaIdOf(point: Coordinates, areas: AreaCircle[]): string | null {
  let best: { id: string; d: number } | null = null;
  for (const area of areas) {
    const d = distanceMeters({ lat: area.lat, lon: area.lon }, point);
    if (d <= area.radiusMeters && (!best || d < best.d)) best = { id: area.id, d };
  }
  return best?.id ?? null;
}

/** Smallest box around an area's circle (to ask the API for its events). */
export function areaBbox(area: AreaCircle): Bbox {
  const dLat = (area.radiusMeters / EARTH_RADIUS_M) * (180 / Math.PI);
  const dLon = dLat / Math.cos((area.lat * Math.PI) / 180);
  return { minLat: area.lat - dLat, maxLat: area.lat + dLat, minLon: area.lon - dLon, maxLon: area.lon + dLon };
}

/** Keeps the items that belong to this area (items without a position are dropped). */
export function inArea<T extends { lat: number | null; lon: number | null }>(items: T[], areaId: string, areas: AreaCircle[]): T[] {
  return items.filter((i) => i.lat !== null && i.lon !== null && areaIdOf({ lat: i.lat, lon: i.lon }, areas) === areaId);
}
