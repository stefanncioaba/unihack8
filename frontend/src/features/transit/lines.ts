// Pure helpers for the live transit layer: line colours, icons and names, matching a route plan's line names to
// line ids, decoding line shapes, and small vehicle helpers (age, nearest vehicle). No React here, so all of it is
// unit-tested directly.
import type { RouteLeg } from '@/api/types.routing';
import type { TransitRoute, TransitRouteType, TransitShape, TransitVehicle } from '@/api/types.transit';
import { distanceMeters, type Coordinates } from '@/lib/geo';
import { parseIso } from '@/lib/time';
import type { IconName } from '@/ui/Icon';

/** One colour per line (readable on the dark map, none of them the app's gold). STPT colours every line of a vehicle
 * type the same (all trams one colour), so the app picks each line's colour from this palette instead. */
export const LINE_PALETTE = [
  '#E4572E',
  '#29B6F6',
  '#66BB6A',
  '#AB47BC',
  '#FF8A65',
  '#26C6DA',
  '#EC407A',
  '#9CCC65',
  '#7E57C2',
  '#FF7043',
  '#5C6BC0',
  '#8D6E63',
  '#EF5350',
  '#42A5F5',
  '#26A69A',
  '#BA68C8',
  '#F06292',
  '#00E676',
  '#4DD0E1',
  '#A1887F',
] as const;

/** A vehicle report older than this is shown as "may be out of date". */
export const VEHICLE_OLD_MS = 2 * 60_000;

/** Small stable hash of a string (same line, same colour, every session). */
function hash(s: string): number {
  let h = 0;
  for (const c of s.toUpperCase()) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h;
}

/** The line's colour: a stable palette colour per line id (same line, same colour, any letter case). STPT's own
 * colour is ignored on purpose, since it is the same for every line of a type. */
export function lineColor(route: string | null | undefined): string {
  return LINE_PALETTE[hash((route ?? '').trim()) % LINE_PALETTE.length];
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
