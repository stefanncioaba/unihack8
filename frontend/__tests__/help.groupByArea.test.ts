// Help Board "Nearby": requests grouped by neighbourhood, your area first, outside ones last; counts for Pulse cards.
import type { HelpRequestSummary } from '@/api/types.help';
import { countByArea, groupByNeighbourhood, OUTSIDE_KEY, OUTSIDE_TITLE, type NamedArea } from '@/features/help/groupByArea';

const AREAS: NamedArea[] = [
  { id: 'cetate', name: 'Cetate', lat: 45.7568, lon: 21.229, radiusMeters: 750 },
  { id: 'fabric', name: 'Fabric', lat: 45.7585, lon: 21.2475, radiusMeters: 900 },
  { id: 'iosefin', name: 'Iosefin', lat: 45.7465, lon: 21.2105, radiusMeters: 800 },
];

/** A request with just what grouping looks at. */
function req(id: string, lat: number | null, lon: number | null): HelpRequestSummary {
  return { id, lat, lon } as HelpRequestSummary;
}

const inCetate = req('c1', 45.757, 21.229);
const inCetate2 = req('c2', 45.7565, 21.2295);
const inFabric = req('f1', 45.7585, 21.2475);
const inIosefin = req('i1', 45.7465, 21.2105);
const farAway = req('x1', 45.7, 21.1);
const noPin = req('x2', null, null);

describe('groupByNeighbourhood', () => {
  it('puts my area first, then the others closest first, and outside ones last', () => {
    const sections = groupByNeighbourhood([inFabric, farAway, inCetate, inIosefin, noPin, inCetate2], AREAS, { lat: 45.757, lon: 21.2475 });
    expect(sections.map((s) => s.key)).toEqual(['fabric', 'cetate', 'iosefin', OUTSIDE_KEY]);
    expect(sections[0]).toMatchObject({ title: 'Fabric', isHere: true });
    expect(sections[1].isHere).toBe(false);
    // Incoming (closest-first) order is kept inside a section.
    expect(sections[1].data.map((r) => r.id)).toEqual(['c1', 'c2']);
    expect(sections[3]).toMatchObject({ title: OUTSIDE_TITLE, isHere: false });
    expect(sections[3].data.map((r) => r.id)).toEqual(['x1', 'x2']);
  });

  it('orders by distance when I am outside every area', () => {
    const sections = groupByNeighbourhood([inCetate, inFabric, inIosefin], AREAS, { lat: 45.74, lon: 21.2 });
    expect(sections.map((s) => s.key)).toEqual(['iosefin', 'cetate', 'fabric']);
    expect(sections.every((s) => !s.isHere)).toBe(true);
  });

  it('keeps the area list order when my position is unknown', () => {
    const sections = groupByNeighbourhood([inIosefin, inFabric, inCetate], AREAS, null);
    expect(sections.map((s) => s.key)).toEqual(['cetate', 'fabric', 'iosefin']);
  });

  it('leaves out empty areas and the outside section when nothing is outside', () => {
    expect(groupByNeighbourhood([inCetate], AREAS, null).map((s) => s.key)).toEqual(['cetate']);
    expect(groupByNeighbourhood([], AREAS, null)).toEqual([]);
  });
});

describe('countByArea', () => {
  it('counts open requests per area and skips the ones outside or without a pin', () => {
    expect(countByArea([inCetate, inCetate2, inFabric, farAway, noPin], AREAS)).toEqual({ cetate: 2, fabric: 1 });
    expect(countByArea([], AREAS)).toEqual({});
  });
});
