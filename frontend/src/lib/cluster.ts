// Grid clustering for map pins (PLAN 14.6). The visible area is cut into cells; a cell with 2+ points becomes one
// cluster at the average position. Pure and fast: no package needed, works with any marker type.
import type { Bbox } from './bbox';

export type Point = { id: string; lat: number; lon: number };

export type Cluster<T extends Point> = { id: string; lat: number; lon: number; items: T[] };

/** Cells across the visible area (per axis). More cells = smaller clusters. */
export const CLUSTER_CELLS = 6;

/** Splits points into lone pins and clusters. With `enabled` false every point stays a lone pin. */
export function clusterPoints<T extends Point>(points: T[], bbox: Bbox | null, enabled: boolean, cells = CLUSTER_CELLS): { singles: T[]; clusters: Cluster<T>[] } {
  if (!enabled || !bbox || points.length < 2) return { singles: points, clusters: [] };
  const width = (bbox.maxLon - bbox.minLon) / cells;
  const height = (bbox.maxLat - bbox.minLat) / cells;
  if (!(width > 0) || !(height > 0)) return { singles: points, clusters: [] };

  const grid = new Map<string, T[]>();
  for (const p of points) {
    const key = `${Math.floor((p.lon - bbox.minLon) / width)}:${Math.floor((p.lat - bbox.minLat) / height)}`;
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
