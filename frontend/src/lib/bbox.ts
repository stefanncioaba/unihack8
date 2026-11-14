// Bounding boxes for map viewports (`bbox=minLon,minLat,maxLon,maxLat`, see docs/API.md conventions).
import type { Coordinates } from './geo';

export type Bbox = { minLon: number; minLat: number; maxLon: number; maxLat: number };

export type MapRegion = { latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number };

/** The area a map region shows. */
export function regionToBbox(region: MapRegion): Bbox {
  return {
    minLon: region.longitude - region.longitudeDelta / 2,
    maxLon: region.longitude + region.longitudeDelta / 2,
    minLat: region.latitude - region.latitudeDelta / 2,
    maxLat: region.latitude + region.latitudeDelta / 2,
  };
}

/** Rounds OUTWARD to 3 decimals (~100 m): minimums down, maximums up, so tiny pans reuse the same cached request and the
 * box never shrinks below the visible area (rounding to nearest hid places at the edges, or emptied the box, when
 * zoomed far in). The small epsilon keeps values already on the grid from growing a whole step. */
export function roundBbox(b: Bbox): Bbox {
  const down = (n: number) => Math.floor(n * 1000 + 1e-6) / 1000;
  const up = (n: number) => Math.ceil(n * 1000 - 1e-6) / 1000;
  return { minLon: down(b.minLon), minLat: down(b.minLat), maxLon: up(b.maxLon), maxLat: up(b.maxLat) };
}

/** The box grown by `factor` of its own size on every side (0.5 = half a screen of extra room each way). */
export function expandBbox(b: Bbox, factor: number): Bbox {
  const w = (b.maxLon - b.minLon) * factor;
  const h = (b.maxLat - b.minLat) * factor;
  return { minLon: b.minLon - w, minLat: b.minLat - h, maxLon: b.maxLon + w, maxLat: b.maxLat + h };
}

/** True when `inner` lies completely inside `outer`. */
export function bboxCovers(outer: Bbox, inner: Bbox): boolean {
  return inner.minLon >= outer.minLon && inner.maxLon <= outer.maxLon && inner.minLat >= outer.minLat && inner.maxLat <= outer.maxLat;
}

/** `bbox` query parameter value. */
export function bboxParam(b: Bbox): string {
  return `${b.minLon},${b.minLat},${b.maxLon},${b.maxLat}`;
}

/** True when a point lies inside the box. */
export function bboxContains(b: Bbox, p: Coordinates): boolean {
  return p.lon >= b.minLon && p.lon <= b.maxLon && p.lat >= b.minLat && p.lat <= b.maxLat;
}
