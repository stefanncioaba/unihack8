// Groups the Help Board's "Nearby" list by neighbourhood (same areas and rule as Neighbourhood Pulse).
import type { HelpRequestSummary } from '@/api/types.help';
import { areaIdOf, type AreaCircle } from '@/features/neighbourhoods/areas';
import { distanceMeters, type Coordinates } from '@/lib/geo';

/** An area with its display name (a NeighbourhoodPulse fits). */
export type NamedArea = AreaCircle & { name: string };

/** One section of the board: an area, or everything outside the areas. */
export type HelpAreaSection = { key: string; title: string; isHere: boolean; data: HelpRequestSummary[] };

/** Key and title of the last section: pinned outside every area, or without a pin (older requests). */
export const OUTSIDE_KEY = 'outside';
export const OUTSIDE_TITLE = 'Outside the neighbourhoods';

/**
 * Splits requests into one section per neighbourhood. The area you are in comes first, then the others
 * closest first (list order when your position is unknown); empty areas are left out and requests outside
 * every area go last. Requests keep their incoming order inside a section (the board is already closest first).
 */
export function groupByNeighbourhood(requests: HelpRequestSummary[], areas: NamedArea[], here: Coordinates | null): HelpAreaSection[] {
  const byArea = new Map<string, HelpRequestSummary[]>();
  const outside: HelpRequestSummary[] = [];
  for (const r of requests) {
    const id = r.lat !== null && r.lon !== null ? areaIdOf({ lat: r.lat, lon: r.lon }, areas) : null;
    if (id === null) outside.push(r);
    else byArea.set(id, [...(byArea.get(id) ?? []), r]);
  }

  const hereId = here ? areaIdOf(here, areas) : null;
  const rank = (a: NamedArea) => (a.id === hereId ? -1 : here ? distanceMeters(here, { lat: a.lat, lon: a.lon }) : 0);
  const sections = areas
    .filter((a) => byArea.has(a.id))
    .map((a, index) => ({ a, index }))
    .sort((x, y) => rank(x.a) - rank(y.a) || x.index - y.index)
    .map(({ a }) => ({ key: a.id, title: a.name, isHere: a.id === hereId, data: byArea.get(a.id)! }));
  if (outside.length > 0) sections.push({ key: OUTSIDE_KEY, title: OUTSIDE_TITLE, isHere: false, data: outside });
  return sections;
}
