// Grid clustering of map pins (14.6).
import { CLUSTER_MIN_SPAN, clusterPoints, shouldCluster } from '@/lib/cluster';

const BOX = { minLon: 21.0, minLat: 45.0, maxLon: 21.6, maxLat: 45.6 }; // 6 cells of 0.1 degrees

const pt = (id: string, lat: number, lon: number) => ({ id, lat, lon });

describe('clusterPoints', () => {
  it('keeps lone points as singles and groups points that share a cell', () => {
    const points = [pt('a', 45.01, 21.01), pt('b', 45.02, 21.02), pt('c', 45.55, 21.55)];
    const { singles, clusters } = clusterPoints(points, BOX, true);
    expect(singles.map((p) => p.id)).toEqual(['c']);
    expect(clusters).toHaveLength(1);
    expect(clusters[0].items.map((p) => p.id)).toEqual(['a', 'b']);
    expect(clusters[0].lat).toBeCloseTo(45.015);
    expect(clusters[0].lon).toBeCloseTo(21.015);
  });

  it('does not group points in neighbouring cells', () => {
    const { singles, clusters } = clusterPoints([pt('a', 45.05, 21.05), pt('b', 45.15, 21.05)], BOX, true);
    expect(clusters).toHaveLength(0);
    expect(singles).toHaveLength(2);
  });

  it('returns every point as a single when disabled, without a bbox, or with fewer than two points', () => {
    const points = [pt('a', 45.01, 21.01), pt('b', 45.02, 21.02)];
    expect(clusterPoints(points, BOX, false)).toEqual({ singles: points, clusters: [] });
    expect(clusterPoints(points, null, true)).toEqual({ singles: points, clusters: [] });
    expect(clusterPoints([points[0]], BOX, true)).toEqual({ singles: [points[0]], clusters: [] });
  });

  it('survives an empty or degenerate area', () => {
    expect(clusterPoints([], BOX, true)).toEqual({ singles: [], clusters: [] });
    const flat = { minLon: 21, minLat: 45, maxLon: 21, maxLat: 45 };
    const two = [pt('a', 45, 21), pt('b', 45, 21)];
    expect(clusterPoints(two, flat, true).singles).toHaveLength(2);
  });

  it('gives every cluster a unique id', () => {
    const points = [pt('a', 45.01, 21.01), pt('b', 45.02, 21.02), pt('c', 45.31, 21.31), pt('d', 45.32, 21.32)];
    const ids = clusterPoints(points, BOX, true).clusters.map((c) => c.id);
    expect(new Set(ids).size).toBe(2);
  });
});

describe('shouldCluster', () => {
  it('clusters only while zoomed out', () => {
    expect(shouldCluster(null)).toBe(false);
    expect(shouldCluster({ minLon: 0, minLat: 45, maxLon: 1, maxLat: 45 + CLUSTER_MIN_SPAN + 0.001 })).toBe(true);
    expect(shouldCluster({ minLon: 0, minLat: 45, maxLon: 1, maxLat: 45 + CLUSTER_MIN_SPAN - 0.001 })).toBe(false);
  });
});
