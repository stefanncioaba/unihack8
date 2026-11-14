// Pure helpers for the one-line view of the Transport layer (like live.stpt.ro): lines grouped by type for the line
// picker, a line's two directions (Tur / Retur) with their path, headsign and stops, and which vehicles run in the
// shown direction. No React here, so all of it is unit-tested directly.
import type { TransitRoute, TransitRouteType, TransitShape, TransitShapeStop, TransitVehicle } from '@/api/types.transit';
import type { Coordinates } from '@/lib/geo';

import { sameLine, typeLabel, vehicleIcon } from './lines';

/** Order of the type groups in the line picker (same as GET /transit/routes). */
export const LINE_GROUP_ORDER: TransitRouteType[] = ['TRAM', 'TROLLEYBUS', 'BUS', 'EXPRESS', 'METROPOLITAN', 'SCHOOL', 'BOAT'];

/** One group of the line picker: a vehicle type and its lines, in the line list's order. */
export type LineGroup = { type: TransitRouteType; label: string; icon: ReturnType<typeof vehicleIcon>; lines: TransitRoute[] };

/** Short plural label of a type group. */
function groupLabel(type: TransitRouteType): string {
  switch (type) {
    case 'TRAM':
      return 'Trams';
    case 'TROLLEYBUS':
      return 'Trolleybuses';
    case 'BUS':
      return 'Buses';
    case 'EXPRESS':
      return 'Express';
    case 'METROPOLITAN':
      return 'Metropolitan';
    case 'SCHOOL':
      return 'School';
    default:
      return `${typeLabel(type)}s`;
  }
}

/** The lines grouped by type (trams first, empty groups left out), each group keeping the list's order. */
export function groupLines(routes: TransitRoute[] | undefined): LineGroup[] {
  const groups: LineGroup[] = [];
  for (const type of LINE_GROUP_ORDER) {
    const lines = (routes ?? []).filter((r) => (r.type ?? 'BUS') === type);
    if (lines.length) groups.push({ type, label: groupLabel(type), icon: vehicleIcon(type), lines });
  }
  return groups;
}

/** One direction of a line ready to draw: TUR / RETUR (null when the data has none), where it goes, the label of its
 * toggle (`→ Gara de Nord`), its path in react-native-maps' coordinate shape, and its stops in order. */
export type LineDirection = {
  key: string;
  direction: 'TUR' | 'RETUR' | null;
  headsign: string | null;
  label: string;
  path: { latitude: number; longitude: number }[];
  stops: TransitShapeStop[];
};

/** One candidate path of a line before picking the main one per direction. */
type Candidate = Omit<LineDirection, 'key' | 'label'>;

/** The toggle label of a direction: the headsign with an arrow, else Tur / Retur. */
export function directionLabel(direction: 'TUR' | 'RETUR' | null, headsign: string | null, index: number): string {
  if (headsign && headsign.trim()) return `→ ${headsign.trim()}`;
  if (direction === 'RETUR') return 'Retur';
  if (direction === 'TUR') return 'Tur';
  return index === 0 ? 'Tur' : 'Retur';
}

/** The better of two paths for one direction: more stops first (the full route, not a short-turn variant), then more
 * points. */
function better(a: Candidate, b: Candidate): Candidate {
  if (a.stops.length !== b.stops.length) return a.stops.length > b.stops.length ? a : b;
  return a.path.length >= b.path.length ? a : b;
}

/** A line's directions from its GET /transit/shapes?route= answer: the main path of Tur and of Retur (the one with the
 * most stops), Tur first. When the data has no directions, the first two paths with different headsigns (or simply
 * the first two paths) stand in for them. Paths with fewer than two points are dropped. `decode` is passed in so this
 * file stays free of the polyline module. */
export function lineDirections(shapes: TransitShape[] | undefined, lineId: string | null, decode: (s: string) => Coordinates[]): LineDirection[] {
  if (!lineId) return [];
  const candidates: Candidate[] = [];
  for (const s of shapes ?? []) {
    if (!sameLine(s.route, lineId)) continue;
    const variants = s.variants?.length ? s.variants : s.polylines.map((polyline) => ({ polyline, direction: null, headsign: null, stops: null }));
    for (const v of variants) {
      const path = decode(v.polyline).map((c) => ({ latitude: c.lat, longitude: c.lon }));
      if (path.length < 2) continue;
      candidates.push({ direction: v.direction ?? null, headsign: v.headsign ?? null, path, stops: v.stops ?? [] });
    }
  }
  const tur = candidates.filter((c) => c.direction === 'TUR');
  const retur = candidates.filter((c) => c.direction === 'RETUR');
  let picked: Candidate[];
  if (tur.length || retur.length) {
    picked = [tur, retur].filter((list) => list.length).map((list) => list.reduce(better));
  } else {
    // No directions in the data: up to two paths, preferring different headsigns.
    const distinct: Candidate[] = [];
    for (const c of candidates) if (!distinct.some((d) => sameHeadsign(d.headsign, c.headsign))) distinct.push(c);
    picked = distinct.slice(0, 2);
  }
  return picked.map((c, i) => ({ ...c, key: `${c.direction ?? 'dir'}-${i}`, label: directionLabel(c.direction, c.headsign, i) }));
}

/** Lower case, no diacritics, punctuation as spaces, single spaces: "Piața  Gh. (AEM)" -> "piata gh aem". */
function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** True when two headsigns name the same terminus: equal once case, diacritics and punctuation are ignored, or one is
 * the other plus extra words ("Piața Gh. Domășneanu (AEM)" and "Piata Gh Domasneanu"). */
export function sameHeadsign(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  const [x, y] = [normalize(a), normalize(b)];
  return !!x && !!y && (x === y || x.startsWith(`${y} `) || y.startsWith(`${x} `));
}

/** The vehicles of the line running in the shown direction (matched by headsign). When no vehicle's headsign matches
 * any of the line's directions (the data does not allow telling them apart), every vehicle of the line is kept. */
export function vehiclesInDirection(vehicles: TransitVehicle[], directions: LineDirection[], index: number): TransitVehicle[] {
  const shown = directions[index];
  if (!shown?.headsign || directions.length < 2) return vehicles;
  const tellable = vehicles.some((v) => directions.some((d) => sameHeadsign(v.headsign, d.headsign)));
  return tellable ? vehicles.filter((v) => sameHeadsign(v.headsign, shown.headsign)) : vehicles;
}

/** The direction a vehicle runs in (by headsign), or 0 when it cannot be told. */
export function directionOfVehicle(directions: LineDirection[], headsign: string | null | undefined): number {
  const i = directions.findIndex((d) => sameHeadsign(d.headsign, headsign));
  return i < 0 ? 0 : i;
}
