// Short text lines for a Neighbourhood Pulse card. Pure functions so they are easy to test.
import type { NeighbourhoodPulse, PulseEvent, PulseLevel } from '@/api/types.neighbourhoods';
import { placeMeta } from '@/features/map/placeCategories';
import { formatTime } from '@/lib/time';

/** Label and chip tone for an activity level. */
export const LEVEL_META: Record<PulseLevel, { label: string; tone: 'accent' | 'signal' | 'muted' }> = {
  BUSY: { label: 'Busy', tone: 'accent' },
  STEADY: { label: 'Steady', tone: 'signal' },
  QUIET: { label: 'Quiet', tone: 'muted' },
};

/** "1 thing", "2 things". */
export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** "2 events now · 3 tonight · 14 free spots", or a quiet message. */
export function eventsLine(area: NeighbourhoodPulse): string {
  const { nowCount, tonightCount, freeSpots } = area.events;
  if (nowCount === 0 && tonightCount === 0) return 'No events tonight';
  const parts: string[] = [];
  if (nowCount > 0) parts.push(`${plural(nowCount, 'event')} now`);
  if (tonightCount > 0) parts.push(nowCount > 0 ? `${tonightCount} tonight` : `${plural(tonightCount, 'event')} tonight`);
  if (freeSpots > 0) parts.push(plural(freeSpots, 'free spot'));
  return parts.join(' · ');
}

/** "Now" or the start time, plus free spots when the event is limited. */
export function eventWhen(event: PulseEvent): string {
  const when = event.happeningNow ? 'Now' : formatTime(event.startsAt);
  if (event.spotsLeft === null) return when;
  return event.spotsLeft === 0 ? `${when} · full` : `${when} · ${plural(event.spotsLeft, 'spot')} left`;
}

/** "Lines 1, 8, E2 · 3 vehicles nearby", or why there is no transit info. */
export function transitLine(area: NeighbourhoodPulse): string {
  const t = area.transit;
  if (!t.available) return 'Live transit unavailable right now';
  if (t.lines.length === 0) return 'No STPT stops in this area';
  const shown = t.lines.slice(0, 6).join(', ') + (t.lines.length > 6 ? ` +${t.lines.length - 6}` : '');
  return `${t.lines.length === 1 ? 'Line' : 'Lines'} ${shown} · ${plural(t.liveVehicles, 'vehicle')} nearby`;
}

/** "42 of 120 places open · Restaurants, Cafés". */
export function placesLine(area: NeighbourhoodPulse): string {
  const { total, openNow, topCategories } = area.places;
  if (total === 0) return 'No places listed';
  const top = topCategories.map((c) => placeMeta(c).label).join(', ');
  return `${openNow} of ${plural(total, 'place')} open now${top ? ` · ${top}` : ''}`;
}

/** "5 going out · 4 reliable", or an invitation when nobody joined yet. */
export function peopleLine(area: NeighbourhoodPulse): string {
  const { going, reliableGoing } = area.people;
  if (going === 0) return 'Nobody has joined an event here yet';
  return `${going} going out · ${reliableGoing} reliable`;
}

/** "Nobody needs help right now", "1 neighbour needs help", "3 neighbours need help" (open Help Board requests). */
export function helpLine(count: number): string {
  if (count === 0) return 'Nobody needs help right now';
  return count === 1 ? '1 neighbour needs help' : `${count} neighbours need help`;
}
