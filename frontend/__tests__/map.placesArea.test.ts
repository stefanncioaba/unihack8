// Place loading for the map: one request per area, reused while panning / zooming in; deep zoom never loses pins.
import { FETCH_MARGIN, nextFetchArea } from '@/hooks/usePlaces';
import { bboxCovers, roundBbox, type Bbox } from '@/lib/bbox';

const view: Bbox = { minLon: 21.2, minLat: 45.75, maxLon: 21.22, maxLat: 45.77 };

describe('nextFetchArea', () => {
  it('loads the view plus a margin when nothing is loaded yet', () => {
    const area = nextFetchArea(null, view);
    expect(bboxCovers(area, view)).toBe(true);
    expect(area.maxLat - area.minLat).toBeGreaterThan((view.maxLat - view.minLat) * (1 + FETCH_MARGIN));
  });

  it('keeps the loaded area (same object) while a pan or zoom stays inside it', () => {
    const area = nextFetchArea(null, view);
    const panned = { minLon: 21.205, minLat: 45.755, maxLon: 21.225, maxLat: 45.775 };
    expect(nextFetchArea(area, panned)).toBe(area);
    const zoomed = { minLon: 21.208, minLat: 45.758, maxLon: 21.212, maxLat: 45.762 };
    expect(nextFetchArea(area, { ...zoomed, minLon: 21.209, maxLon: 21.211 })).toBeDefined();
  });

  it('loads a new area when the view leaves the loaded one', () => {
    const area = nextFetchArea(null, view);
    const far = { minLon: 21.3, minLat: 45.8, maxLon: 21.32, maxLat: 45.82 };
    const next = nextFetchArea(area, far);
    expect(next).not.toBe(area);
    expect(bboxCovers(next, far)).toBe(true);
  });

  it('replaces a big loaded area once the view is much smaller, and still covers a deep zoom', () => {
    const area = nextFetchArea(null, view);
    const deep = { minLon: 21.2101, minLat: 45.7601, maxLon: 21.2103, maxLat: 45.7603 };
    const next = nextFetchArea(area, deep);
    expect(next).not.toBe(area);
    expect(bboxCovers(next, deep)).toBe(true);
    expect(next.maxLat).toBeGreaterThan(next.minLat);
  });

  it('a rounded deep-zoom box still contains the view (rounding is outward)', () => {
    const deep = { minLon: 21.21005, minLat: 45.76005, maxLon: 21.21009, maxLat: 45.76009 };
    expect(bboxCovers(roundBbox(deep), deep)).toBe(true);
  });
});
