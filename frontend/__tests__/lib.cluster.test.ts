// Grid clustering of map pins (14.6).
import { clampBbox } from '@/hooks/useMapEvents';
import { CLUSTER_MIN_SPAN, CLUSTER_ZOOM_MIN_SPAN, clusterCellSize, clusterPoints, clusterZoomTarget, shouldCluster, spreadStacked } from '@/lib/cluster';

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

describe('clustering at large spans', () => {
  it('groups a whole city of events into a few count bubbles when zoomed far out', () => {
    // 40 events spread over central Timișoara, viewed with a ~0.5 degree (city + surroundings) span.
    const events = Array.from({ length: 40 }, (_, i) => pt(`e${i}`, 45.74 + (i % 8) * 0.004, 21.21 + Math.floor(i / 8) * 0.005));
    const view = { minLon: 20.97, minLat: 45.5, maxLon: 21.47, maxLat: 46.0 };
    expect(shouldCluster(view)).toBe(true);
    const { singles, clusters } = clusterPoints(events, view, true);
    expect(singles).toHaveLength(0);
    expect(clusters.length).toBeGreaterThan(0);
    expect(clusters.length).toBeLessThanOrEqual(4);
    expect(clusters.reduce((n, c) => n + c.items.length, 0)).toBe(40); // nothing is dropped
  });

  it('still shows points when the whole world is in view', () => {
    const world = { minLon: -180, minLat: -85, maxLon: 180, maxLat: 85 };
    const { singles, clusters } = clusterPoints([pt('a', 45.75, 21.22), pt('b', 45.76, 21.23), pt('c', 44.43, 26.1)], world, true);
    expect(clusters).toHaveLength(1);
    expect(clusters[0].items).toHaveLength(3);
    expect(singles).toHaveLength(0);
  });
});

describe('clusterZoomTarget', () => {
  it('zooms to the middle of the points with a span that fits them', () => {
    const t = clusterZoomTarget([pt('a', 45.7, 21.2), pt('b', 45.8, 21.3)], 1);
    expect(t.lat).toBeCloseTo(45.75);
    expect(t.lon).toBeCloseTo(21.25);
    expect(t.span).toBeCloseTo(0.16);
  });

  it('always zooms in at least by half, and never closer than the minimum', () => {
    expect(clusterZoomTarget([pt('a', 45.0, 21.0), pt('b', 45.5, 21.5)], 0.6).span).toBeCloseTo(0.3);
    expect(clusterZoomTarget([pt('a', 45.75, 21.22), pt('b', 45.75, 21.22)], 0.05).span).toBe(CLUSTER_ZOOM_MIN_SPAN);
  });
});

describe('spreadStacked', () => {
  it('fans out points at the very same spot so each stays tappable, and keeps lone points as they are', () => {
    const lone = pt('c', 45.76, 21.23);
    const out = spreadStacked([pt('a', 45.75, 21.22), pt('b', 45.75, 21.22), pt('b2', 45.750001, 21.220001), lone], CLUSTER_ZOOM_MIN_SPAN);
    expect(out).toHaveLength(4);
    expect(out).toContain(lone);
    const fanned = out.filter((p) => p.id !== 'c');
    expect(new Set(fanned.map((p) => `${p.lat}:${p.lon}`)).size).toBe(3);
    for (const p of fanned) {
      expect(Math.abs(p.lat - 45.75)).toBeLessThan(0.001);
      expect(Math.abs(p.lon - 21.22)).toBeLessThan(0.001);
    }
  });

  it('spreads wider on a wider view and leaves distinct spots alone', () => {
    const pair = [pt('a', 45.75, 21.22), pt('b', 45.75, 21.22)];
    const gap = (span: number) => {
      const [a, b] = spreadStacked(pair, span);
      return Math.hypot(a.lat - b.lat, a.lon - b.lon);
    };
    expect(gap(0.01)).toBeGreaterThan(gap(0.004));
    const apart = [pt('a', 45.75, 21.22), pt('b', 45.751, 21.22)];
    expect(spreadStacked(apart, 0.004)).toEqual(apart);
  });
});

describe('clampBbox', () => {
  it('keeps a far zoomed-out view inside valid coordinates', () => {
    expect(clampBbox({ minLon: -250, minLat: -120, maxLon: 260, maxLat: 95 })).toEqual({ minLon: -180, minLat: -90, maxLon: 180, maxLat: 90 });
    expect(clampBbox(BOX)).toEqual(BOX);
  });
});

describe('stable clusters (grid fixed to the world, not the screen)', () => {
  const pts = [pt('a', 45.7501, 21.2201), pt('b', 45.7503, 21.2203), pt('c', 45.7701, 21.2401), pt('d', 45.7503, 21.2301)];
  const view = { minLon: 21.2, minLat: 45.74, maxLon: 21.26, maxLat: 45.8 };
  const groups = (box: typeof view) => clusterPoints(pts, box, true).clusters.map((c) => c.id).sort();

  it('a tiny jitter of the view (even of its size) gives the same groups', () => {
    const base = groups(view);
    expect(groups({ minLon: view.minLon + 0.0007, minLat: view.minLat - 0.0004, maxLon: view.maxLon + 0.0007, maxLat: view.maxLat - 0.0004 })).toEqual(base);
    expect(groups({ ...view, maxLon: view.maxLon + 0.002, maxLat: view.maxLat + 0.002 })).toEqual(base);
  });

  it('panning a larger distance keeps points in the same groups', () => {
    const shifted = clusterPoints(pts, { ...view, minLon: view.minLon + 0.01, maxLon: view.maxLon + 0.01 }, true);
    expect(shifted.clusters.map((c) => c.id).sort()).toEqual(groups(view));
  });

  it('cell size snaps to a power of two and follows the span', () => {
    expect(clusterCellSize(0.06)).toBe(clusterCellSize(0.062));
    expect(clusterCellSize(0.12)).toBe(clusterCellSize(0.06) * 2);
    expect(Math.log2(clusterCellSize(0.07))).toBe(Math.round(Math.log2(clusterCellSize(0.07))));
  });
});
