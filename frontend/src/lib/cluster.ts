// Grid clustering for map pins (PLAN 14.6). The visible area is cut into cells; a cell with 2+ points becomes one
// cluster at the average position. Pure and fast: no package needed, works with any marker type.
import type { Bbox } from './bbox';

export type Point = { id: string; lat: number; lon: number };

export type Cluster<T extends Point> = { id: string; lat: number; lon: number; items: T[] };

/** Cells across the visible area (per axis). More cells = smaller clusters. */
export const CLUSTER_CELLS = 6;

/** Size (degrees) of one cluster cell for a view: span / cells, snapped to a power of two. Snapping means a small zoom
 * or pan jitter gives the same size, so the groups do not reshuffle while the camera is still. */
export function clusterCellSize(span: number, cells = CLUSTER_CELLS): number {
  return 2 ** Math.round(Math.log2(span / cells));
}

/** Splits points into lone pins and clusters. With `enabled` false every point stays a lone pin. The grid is fixed to
 * the world (cell edges at multiples of the cell size), not to the screen edge, so the same places stay grouped the
 * same way however the view is panned, and clusters are stable between the small region updates a map sends. */
export function clusterPoints<T extends Point>(points: T[], bbox: Bbox | null, enabled: boolean, cells = CLUSTER_CELLS): { singles: T[]; clusters: Cluster<T>[] } {
  if (!enabled || !bbox || points.length < 2) return { singles: points, clusters: [] };
  const span = Math.max(bbox.maxLon - bbox.minLon, bbox.maxLat - bbox.minLat);
  if (!(span > 0)) return { singles: points, clusters: [] };
  const size = clusterCellSize(span, cells);

  const grid = new Map<string, T[]>();
  for (const p of points) {
    const key = `${size}:${Math.floor(p.lon / size)}:${Math.floor(p.lat / size)}`;
    const bucket = grid.get(key);
    if (bucket) bucket.push(p);
    else grid.set(key, [p]);
  }

  const singles: T[] = [];
  const clusters: Cluster<T>[] = [];
  for (const [key, items] of grid) {
    if (items.length === 1) {
      singles.push(items[0]);
    } else {
      const lat = items.reduce((sum, p) => sum + p.lat, 0) / items.length;
      const lon = items.reduce((sum, p) => sum + p.lon, 0) / items.length;
      clusters.push({ id: `cluster:${key}`, lat, lon, items });
    }
  }
  return { singles, clusters };
}

/** Pins are grouped only while the view spans more than this many degrees of latitude (about 1.3 km). */
export const CLUSTER_MIN_SPAN = 0.012;

/** True when a view of this latitude span is zoomed out enough to cluster. */
export function shouldCluster(bbox: Bbox | null): boolean {
  return !!bbox && bbox.maxLat - bbox.minLat > CLUSTER_MIN_SPAN;
}

/** Smallest view span (degrees) a cluster tap zooms to, about 450 m. */
export const CLUSTER_ZOOM_MIN_SPAN = 0.004;

/** Where a tap on a cluster should zoom: the middle of its points, with a span that fits them all (plus a margin),
 * never wider than half the current view so every tap really zooms in. */
export function clusterZoomTarget(items: Point[], currentSpan: number): { lat: number; lon: number; span: number } {
  const lats = items.map((p) => p.lat);
  const lons = items.map((p) => p.lon);
  const [minLat, maxLat, minLon, maxLon] = [Math.min(...lats), Math.max(...lats), Math.min(...lons), Math.max(...lons)];
  const fit = Math.max(maxLat - minLat, maxLon - minLon) * 1.6;
  const half = currentSpan > 0 ? currentSpan / 2 : fit;
  const span = Math.max(CLUSTER_ZOOM_MIN_SPAN, Math.min(fit, half));
  return { lat: (minLat + maxLat) / 2, lon: (minLon + maxLon) / 2, span };
}

/** Points closer than this (degrees, about 1 m) count as the same spot, e.g. several events at one venue. */
export const SAME_SPOT_DEG = 0.00001;

/** Fans out points that share (almost) one spot onto a small circle around it, so each pin can still be tapped once
 * clustering is off. The radius follows the view span (`span` degrees of latitude), so the pins stay a few pin-widths
 * apart at any zoom. Points alone at their spot are returned unchanged (same objects). */
export function spreadStacked<T extends Point>(points: T[], span: number): T[] {
  const groups = new Map<string, T[]>();
  for (const p of points) {
    const key = `${Math.round(p.lat / SAME_SPOT_DEG)}:${Math.round(p.lon / SAME_SPOT_DEG)}`;
    const group = groups.get(key);
    if (group) group.push(p);
    else groups.set(key, [p]);
  }
  const radius = Math.max(0.00004, (span > 0 ? span : CLUSTER_ZOOM_MIN_SPAN) * 0.04);
  const out: T[] = [];
  for (const group of groups.values()) {
    if (group.length === 1) {
      out.push(group[0]);
      continue;
    }
    const { lat, lon } = group[0];
    const lonScale = 1 / Math.max(0.2, Math.cos((lat * Math.PI) / 180));
    group.forEach((p, i) => {
      const angle = (2 * Math.PI * i) / group.length - Math.PI / 2;
      out.push({ ...p, lat: lat + radius * Math.sin(angle), lon: lon + radius * lonScale * Math.cos(angle) });
    });
  }
  return out;
}
