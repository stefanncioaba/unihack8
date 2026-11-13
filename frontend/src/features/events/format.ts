// Text helpers for events: spots, prices, error-to-message mapping for join / leave.
import type { EventSummary } from '@/api/types';

/** "4 spots left", "Full", "Open to all" or null for imported events. */
export function spotsLabel(e: Pick<EventSummary, 'source' | 'capacity' | 'spotsLeft'>): string | null {
  if (e.source === 'EXTERNAL') return null;
  if (e.capacity === null || e.spotsLeft === null) return 'Open to all';
  if (e.spotsLeft === 0) return 'Full';
  return `${e.spotsLeft} ${e.spotsLeft === 1 ? 'spot' : 'spots'} left`;
}

/** "Free", "60 lei" or "60–120 lei"; null when the price is unknown. */
export function priceLabel(e: Pick<EventSummary, 'priceMin' | 'priceMax'>): string | null {
  const { priceMin: min, priceMax: max } = e;
  if (min === null && max === null) return null;
  const lo = min ?? max ?? 0;
  const hi = max ?? min ?? 0;
  if (lo === 0 && hi === 0) return 'Free';
  return lo === hi ? `${lo} lei` : `${lo}–${hi} lei`;
}

/** The one availability/price chip text shown on cards. */
export function availabilityLabel(e: EventSummary): string | null {
  return e.source === 'EXTERNAL' ? priceLabel(e) : spotsLabel(e);
}

/** True when the event is a user event with a limit and no spot is left. */
export function isFull(e: Pick<EventSummary, 'source' | 'capacity' | 'spotsLeft'>): boolean {
  return e.source === 'USER' && e.capacity !== null && e.spotsLeft === 0;
}
