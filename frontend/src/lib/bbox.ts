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

/** Rounds to 3 decimals (~100 m) so tiny pans reuse the same cached request. */
export function roundBbox(b: Bbox): Bbox {
  const r = (n: number) => Math.round(n * 1000) / 1000;
  return { minLon: r(b.minLon), minLat: r(b.minLat), maxLon: r(b.maxLon), maxLat: r(b.maxLat) };
}

/** `bbox` query parameter value. */
export function bboxParam(b: Bbox): string {
  return `${b.minLon},${b.minLat},${b.maxLon},${b.maxLat}`;
}

/** True when a point lies inside the box. */
export function bboxContains(b: Bbox, p: Coordinates): boolean {
  return p.lon >= b.minLon && p.lon <= b.maxLon && p.lat >= b.minLat && p.lat <= b.maxLat;
}
