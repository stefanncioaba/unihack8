// Pure helpers for the live transit layer: line colours, icons and names, matching a route plan's line names to
// line ids, decoding line shapes, and small vehicle helpers (age, nearest vehicle). No React here, so all of it is
// unit-tested directly.
import type { RouteLeg } from '@/api/types.routing';
import type { TransitRoute, TransitRouteType, TransitShape, TransitVehicle } from '@/api/types.transit';
import type { Bbox } from '@/lib/bbox';
import { distanceMeters, type Coordinates } from '@/lib/geo';
import { parseIso } from '@/lib/time';
import type { IconName } from '@/ui/Icon';

/** The hue family a line is coloured from: its vehicle type (live.stpt.ro groups and colours lines the same way). */
export type LineFamily = 'TRAM' | 'TROLLEYBUS' | 'BUS' | 'EXPRESS' | 'METROPOLITAN' | 'SCHOOL' | 'BOAT';

/** Ten shades per type family, readable on the dark map: trams yellows / golds, trolleybuses purples, city buses
 * teals, express oranges, school reds, metropolitan blues / greens, boats light blues. Each line gets one shade of its
 * family (see lineColor), so lines of one type look related but can still be told apart. */
export const FAMILY_PALETTES: Record<LineFamily, readonly string[]> = {
  TRAM: ['#FFD700', '#FFC107', '#F2B807', '#FFE45C', '#E0A800', '#FFCA28', '#D4A017', '#FFDF4F', '#F9A825', '#FFEB3B'],
  TROLLEYBUS: ['#9C27B0', '#AB47BC', '#BA68C8', '#8E24AA', '#CE93D8', '#7B1FA2', '#B388FF', '#9575CD', '#D05CE3', '#7C4DFF'],
  BUS: ['#009688', '#26A69A', '#4DB6AC', '#00897B', '#1DE9B6', '#00BFA5', '#80CBC4', '#00796B', '#64FFDA', '#14B8A6'],
  EXPRESS: ['#FF9800', '#FFA726', '#FB8C00', '#FFB74D', '#F57C00', '#FF8F00', '#FFAB40', '#EF6C00', '#FF9E40', '#E65100'],
  METROPOLITAN: ['#1E88E5', '#43A047', '#42A5F5', '#66BB6A', '#29B6F6', '#2E7D32', '#5C6BC0', '#9CCC65', '#039BE5', '#00C853'],
  SCHOOL: ['#E53935', '#EF5350', '#F44336', '#FF5252', '#D32F2F', '#E57373', '#FF1744', '#C62828', '#FF6E6E', '#B71C1C'],
  BOAT: ['#4FC3F7', '#81D4FA', '#03A9F4', '#29B6F6', '#B3E5FC', '#0288D1', '#4DD0E1', '#00B8D4', '#80DEEA', '#0097A7'],
};

/** Every colour a line can get (all families). */
export const LINE_PALETTE: readonly string[] = Object.values(FAMILY_PALETTES).flat();

/** A vehicle report older than this is shown as "may be out of date". */
export const VEHICLE_OLD_MS = 2 * 60_000;

/** Small stable hash of a string (same line, same colour, every session). */
function hash(s: string): number {
  let h = 0;
  for (const c of s.toUpperCase()) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h;
}

// Line id (upper case) -> type, learnt from the line list, vehicles and shapes as they load (see registerLineTypes).
const knownTypes = new Map<string, TransitRouteType>();

/** Remembers the type of each line (from GET /transit/routes items, vehicles or shapes), so lineColor, which only gets
 * a line id, picks the right hue family. The data hooks call it before the answer reaches the screen. */
export function registerLineTypes(items: { id?: string | null; route?: string | null; type: TransitRouteType | null }[] | undefined): void {
  for (const item of items ?? []) {
    const id = (item.id ?? item.route ?? '').trim().toUpperCase();
    if (id && item.type && !knownTypes.has(id)) knownTypes.set(id, item.type);
  }
}

/** Forgets every learnt line type (tests). */
export function clearLineTypes(): void {
  knownTypes.clear();
}

/** A line's family from its name when its type is not known yet: `E..` express, `M..` metropolitan, `S..` school,
 * `Tv..` tram, `Tb..` trolleybus, anything else a city bus. */
export function guessLineFamily(route: string): LineFamily {
  const id = route.trim().toUpperCase();
  if (/^E\d/.test(id)) return 'EXPRESS';
  if (/^M\d/.test(id)) return 'METROPOLITAN';
  if (/^S\d/.test(id)) return 'SCHOOL';
  if (/^TV/.test(id)) return 'TRAM';
  if (/^TB/.test(id)) return 'TROLLEYBUS';
  return 'BUS';
}

/** The hue family of a line: its known type, else a guess from its name. */
export function lineFamily(route: string | null | undefined): LineFamily {
  const id = (route ?? '').trim();
  return knownTypes.get(id.toUpperCase()) ?? guessLineFamily(id);
}

/** Index of a line's shade within its family: from the number in its id, so consecutive lines (1, 2, 3 or E1, E2) get
 * different shades, plus its letters (5 and 5b differ); a hash for ids without a number. */
export function shadeIndex(route: string, shades: number): number {
  const id = route.trim().toUpperCase();
  const m = /(\d+)/.exec(id);
  if (!m) return hash(id) % shades;
  const letters = id.replace(m[1], '');
  return (Number(m[1]) + (letters ? hash(letters) : 0)) % shades;
}

/** The line's colour: a stable shade of its type's family (same line, same colour, any letter case). STPT's own
 * colour is ignored on purpose, since it is the same for every line of a type. */
export function lineColor(route: string | null | undefined): string {
  const palette = FAMILY_PALETTES[lineFamily(route)];
  return palette[shadeIndex((route ?? '').trim(), palette.length)];
}

/** Text / icon colour readable on a line colour: ink on light shades (yellows, light teals), white on the rest. */
export function textOnColor(hex: string): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return '#fff';
  const n = parseInt(m[1], 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return 0.299 * r + 0.587 * g + 0.114 * b > 160 ? '#000814' : '#fff';
}

/** `#rrggbb` (or `#rgb`) with an opacity, as `rgba(...)`. Other strings come back unchanged. */
export function withAlpha(hex: string, alpha: number): string {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const h = m[1].length === 3 ? m[1].split('').map((c) => c + c).join('') : m[1];
  const n = parseInt(h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

/** Icon for a vehicle type: tram, trolleybus (electric), boat, or bus for everything else. */
export function vehicleIcon(type: TransitRouteType | null | undefined): IconName {
  switch (type) {
    case 'TRAM':
      return 'train';
    case 'TROLLEYBUS':
      return 'flash';
    case 'BOAT':
      return 'boat';
    default:
      return 'bus';
  }
}

/** Readable vehicle type, `Line` when unknown. */
export function typeLabel(type: TransitRouteType | null | undefined): string {
  switch (type) {
    case 'TRAM':
      return 'Tram';
    case 'TROLLEYBUS':
      return 'Trolleybus';
    case 'BUS':
      return 'Bus';
    case 'EXPRESS':
      return 'Express bus';
    case 'METROPOLITAN':
      return 'Metropolitan bus';
    case 'SCHOOL':
      return 'School bus';
    case 'BOAT':
      return 'Boat';
    default:
      return 'Line';
  }
}

/** True when two line ids / names are the same line (STPT ids are compared case-insensitively). */
export function sameLine(a: string | null | undefined, b: string | null | undefined): boolean {
  return !!a && !!b && a.trim().toUpperCase() === b.trim().toUpperCase();
}

/** Maps a route plan leg's line (an id or a display name like "E2") to the /transit/routes id.
 * Without the line list (still loading or failed) the name itself is used, since ids and names usually match. */
export function resolveLineId(name: string | null | undefined, routes: TransitRoute[] | undefined): string | null {
  if (!name || !name.trim()) return null;
  if (!routes?.length) return name.trim();
  const byId = routes.find((r) => sameLine(r.id, name));
  if (byId) return byId.id;
  const byName = routes.find((r) => sameLine(r.name, name));
  return byName ? byName.id : name.trim();
}

/** The distinct line ids of a plan's ride legs (tram, trolleybus, bus), in order. */
export function rideLegLines(legs: RouteLeg[] | undefined, routes: TransitRoute[] | undefined): string[] {
  const out: string[] = [];
  for (const leg of legs ?? []) {
    if (leg.mode === 'WALK') continue;
    const id = resolveLineId(leg.route, routes);
    if (id && !out.some((o) => sameLine(o, id))) out.push(id);
  }
  return out;
}

/** The vehicles of one line, or all of them when no line is given. */
export function vehiclesOfLine(vehicles: TransitVehicle[] | undefined, lineId: string | null): TransitVehicle[] {
  if (!vehicles) return [];
  return lineId ? vehicles.filter((v) => sameLine(v.route, lineId)) : vehicles;
}

/** Extra area around the visible map (as a share of its width / height, per side; 1 = one more view on each side)
 * whose vehicles are still drawn, so a short pan does not leave the edges empty until the next region update. */
export const VEHICLE_VIEW_MARGIN = 1;

/** The vehicles inside the visible area plus a margin (VEHICLE_VIEW_MARGIN). Without a bbox every vehicle is kept.
 * Hundreds of custom markers off screen still cost the map work on every frame, so they are not drawn. */
export function vehiclesInView(vehicles: TransitVehicle[], bbox: Bbox | null | undefined, margin = VEHICLE_VIEW_MARGIN): TransitVehicle[] {
  if (!bbox) return vehicles;
  const dLat = (bbox.maxLat - bbox.minLat) * margin;
  const dLon = (bbox.maxLon - bbox.minLon) * margin;
  const [minLat, maxLat, minLon, maxLon] = [bbox.minLat - dLat, bbox.maxLat + dLat, bbox.minLon - dLon, bbox.maxLon + dLon];
  return vehicles.filter((v) => v.lat >= minLat && v.lat <= maxLat && v.lon >= minLon && v.lon <= maxLon);
}

/** The name to print on a vehicle badge. */
export function vehicleLineName(v: Pick<TransitVehicle, 'route' | 'routeName'>): string {
  return v.routeName || v.route || '?';
}

/** `just now`, `25 s ago`, `3 min ago`, `2 h ago` for a report time. */
export function relativeAge(iso: string, now: number = Date.now()): string {
  const ms = now - parseIso(iso);
  if (!Number.isFinite(ms)) return 'unknown';
  const s = Math.round(ms / 1000);
  if (s < 5) return 'just now';
  if (s < 60) return `${s} s ago`;
  const min = Math.round(s / 60);
  if (min < 60) return `${min} min ago`;
  return `${Math.round(min / 60)} h ago`;
}

/** True when a report is older than VEHICLE_OLD_MS. */
export function isReportOld(iso: string, now: number = Date.now()): boolean {
  const t = parseIso(iso);
  return Number.isFinite(t) && now - t > VEHICLE_OLD_MS;
}

/** The vehicle nearest a point (e.g. the boarding stop), preferring those heading to `headsign` when any are.
 * Returns the vehicle with its straight-line distance, or null when there are none. */
export function nearestVehicle(
  vehicles: TransitVehicle[],
  point: Coordinates,
  headsign?: string | null,
): { vehicle: TransitVehicle; meters: number } | null {
  const sameWay = headsign ? vehicles.filter((v) => sameLine(v.headsign, headsign)) : [];
  const pool = sameWay.length ? sameWay : vehicles;
  let best: { vehicle: TransitVehicle; meters: number } | null = null;
  for (const v of pool) {
    const meters = distanceMeters(point, { lat: v.lat, lon: v.lon });
    if (!best || meters < best.meters) best = { vehicle: v, meters };
  }
  return best;
}

/** One line ready to draw: its colour and decoded paths in react-native-maps' coordinate shape. */
export type DrawnShape = { route: string; color: string; paths: { latitude: number; longitude: number }[][] };

/** Decodes every line's polylines once (callers memoise on the shapes array). Paths with fewer than two points are
 * dropped. Entries for the same line (the backend can send one per GTFS route of a line) are merged into one, so each
 * line is drawn once. `decode` is passed in so this file stays free of the polyline module's details in tests. */
export function decodeShapes(shapes: TransitShape[] | undefined, decode: (s: string) => Coordinates[]): DrawnShape[] {
  const out: DrawnShape[] = [];
  for (const s of shapes ?? []) {
    const paths = s.polylines
      .map((p) => decode(p).map((c) => ({ latitude: c.lat, longitude: c.lon })))
      .filter((path) => path.length >= 2);
    const known = out.find((d) => sameLine(d.route, s.route));
    if (known) known.paths.push(...paths);
    else out.push({ route: s.route, color: lineColor(s.route), paths });
  }
  return out;
}
