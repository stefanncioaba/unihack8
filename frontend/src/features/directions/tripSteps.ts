// Trip guidance on the map: turns a route plan's legs into the markers drawn along it ("Board Tram 1 → … · 18:08" at
// the boarding stop, "Get off at …" at the last stop of a ride, "Walk 4 min" halfway along each walk). Pure, so it is
// unit-tested directly; TripMarkers draws the board / get-off steps (walk steps are kept for callers but not drawn).
import type { LegMode, RouteLeg } from '@/api/types.routing';
import type { TransitRoute } from '@/api/types.transit';
import { legPoints } from '@/features/journey/progress';
import { lineColor, resolveLineId } from '@/features/transit/lines';
import { distanceMeters, type Coordinates } from '@/lib/geo';
import { formatTime, parseIso } from '@/lib/time';
import type { IconName } from '@/ui/Icon';

export type TripStepKind = 'board' | 'alight' | 'walk';

/** One marker on the drawn route. `key` is stable for the same plan (kind + leg index). */
export type TripStep = {
  key: string;
  kind: TripStepKind;
  legIndex: number;
  mode: LegMode;
  coord: Coordinates;
  label: string;
  /** Line colour for ride markers, null for walking. */
  color: string | null;
  icon: IconName;
};

/** Readable name of a ride mode. */
export function modeName(mode: LegMode): string {
  return mode === 'TRAM' ? 'Tram' : mode === 'TROLLEYBUS' ? 'Trolleybus' : mode === 'BUS' ? 'Bus' : 'Walk';
}

/** Icon of a leg mode (same icons as the vehicle badges). */
export function modeIcon(mode: LegMode): IconName {
  return mode === 'TRAM' ? 'train' : mode === 'TROLLEYBUS' ? 'flash' : mode === 'BUS' ? 'bus' : 'walk';
}

/** The point halfway along a path (by distance), or its only point. Null for an empty path. */
export function pathMidpoint(path: Coordinates[]): Coordinates | null {
  if (path.length === 0) return null;
  if (path.length === 1) return path[0];
  const parts = path.slice(1).map((p, i) => distanceMeters(path[i], p));
  const total = parts.reduce((a, b) => a + b, 0);
  if (total === 0) return path[0];
  let left = total / 2;
  for (let i = 0; i < parts.length; i++) {
    if (left <= parts[i]) {
      const f = parts[i] === 0 ? 0 : left / parts[i];
      const a = path[i];
      const b = path[i + 1];
      return { lat: a.lat + (b.lat - a.lat) * f, lon: a.lon + (b.lon - a.lon) * f };
    }
    left -= parts[i];
  }
  return path[path.length - 1];
}

/** "Board Tram 1 → Gara de Nord · 18:08" (headsign falls back to the last stop, time left out when unknown). */
export function boardLabel(leg: RouteLeg): string {
  const line = [modeName(leg.mode), leg.route?.trim()].filter(Boolean).join(' ');
  const towards = leg.headsign?.trim() || leg.to?.name?.trim();
  const time = leg.startsAt && Number.isFinite(parseIso(leg.startsAt)) ? ` · ${formatTime(leg.startsAt)}` : '';
  return `Board ${line}${towards ? ` → ${towards}` : ''}${time}`;
}

/** "Get off at Piața Victoriei", or "Get off here" without a stop name. */
export function alightLabel(leg: RouteLeg): string {
  const name = leg.to?.name?.trim();
  return name ? `Get off at ${name}` : 'Get off here';
}

/** "Walk 4 min", plus " to <destination>" on the final walk. */
export function walkLabel(leg: RouteLeg, destinationName?: string | null): string {
  const minutes = Math.max(1, Math.round(leg.durationMinutes));
  const to = destinationName?.trim();
  return `Walk ${minutes} min${to ? ` to ${to}` : ''}`;
}

/** The leg's first / last point: its named place, else the ends of its polyline. */
function legEnd(leg: RouteLeg, end: 'from' | 'to'): Coordinates | null {
  const place = leg[end];
  if (place) return { lat: place.lat, lon: place.lon };
  const points = legPoints(leg);
  return (end === 'from' ? points[0] : points[points.length - 1]) ?? null;
}

/** The colour of a ride leg's line. The leg names its line as the planner does (sometimes a name such as "E2"), so it is
 * mapped to the /transit/routes id first: the same id the live vehicles and the Transport lines are coloured by. */
export function legLineColor(leg: RouteLeg, routes?: TransitRoute[] | null): string {
  return lineColor(resolveLineId(leg.route, routes ?? undefined));
}

/** Every guidance marker of a plan, in travel order: board + get-off for each ride, one label per walk. The final walk
 * names the destination (`destinationName`, else the leg's own end name unless it is the planner's generic one).
 * Legs without any position are skipped. `routes` (GET /transit/routes) makes the ride colours match the vehicles'. */
export function tripSteps(legs: RouteLeg[] | undefined | null, destinationName?: string | null, routes?: TransitRoute[] | null): TripStep[] {
  const out: TripStep[] = [];
  (legs ?? []).forEach((leg, i, all) => {
    if (leg.mode === 'WALK') {
      const mid = pathMidpoint(legPoints(leg));
      if (!mid) return;
      const last = i === all.length - 1;
      const endName = leg.to?.name && leg.to.name !== 'Destination' ? leg.to.name : null;
      const to = last ? destinationName?.trim() || endName : null;
      out.push({ key: `walk-${i}`, kind: 'walk', legIndex: i, mode: 'WALK', coord: mid, label: walkLabel(leg, to), color: null, icon: 'walk' });
      return;
    }
    const color = legLineColor(leg, routes);
    const icon = modeIcon(leg.mode);
    const from = legEnd(leg, 'from');
    const to = legEnd(leg, 'to');
    if (from) out.push({ key: `board-${i}`, kind: 'board', legIndex: i, mode: leg.mode, coord: from, label: boardLabel(leg), color, icon });
    if (to) out.push({ key: `alight-${i}`, kind: 'alight', legIndex: i, mode: leg.mode, coord: to, label: alightLabel(leg), color, icon: 'exit-outline' });
  });
  return out;
}

/** The colour a leg's line is drawn in: the line colour for rides (see legLineColor), `walkColor` for walking. */
export function legStrokeColor(leg: RouteLeg, walkColor: string, routes?: TransitRoute[] | null): string {
  return leg.mode === 'WALK' ? walkColor : legLineColor(leg, routes);
}
