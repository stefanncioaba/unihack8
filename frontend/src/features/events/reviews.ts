// Text helpers for event reviews: rating summaries and the "reviews close / settled" hint.
import type { EventReviews, EventSummary } from '@/api/types';
import { formatEventDate, parseIso } from '@/lib/time';

/** One decimal, always shown (`4.0`, `4.3`). */
export function formatRating(avg: number): string {
  return avg.toFixed(1);
}

/** "4.3 · 12 reviews", "5.0 · 1 review", or "No reviews yet". */
export function ratingSummary(averageRating: number | null, reviewCount: number): string {
  if (averageRating === null || reviewCount === 0) return 'No reviews yet';
  return `${formatRating(averageRating)} · ${reviewCount} ${reviewCount === 1 ? 'review' : 'reviews'}`;
}

/** Compact card label like "4.3 (12)"; null when the event has no reviews. */
export function compactRating(e: Pick<EventSummary, 'averageRating' | 'reviewCount'>): string | null {
  if (e.averageRating === null || e.averageRating === undefined || !e.reviewCount) return null;
  return `${formatRating(e.averageRating)} (${e.reviewCount})`;
}

/** Status line under the rating: settled, closed, or when the review window closes; null for imported events. */
export function reviewsHint(r: Pick<EventReviews, 'reviewsCloseAt' | 'settled'>, now: number = Date.now()): string | null {
  if (r.settled) return 'Ratings settled';
  if (!r.reviewsCloseAt) return null;
  if (parseIso(r.reviewsCloseAt) <= now) return 'Reviews closed';
  return `Reviews close ${formatEventDate(r.reviewsCloseAt)}`;
}
