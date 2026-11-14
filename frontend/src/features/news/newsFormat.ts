// Text helpers for news items (PLAN 26).
import { formatDay, formatTime } from '@/lib/time';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

/** "Just now", "12 min ago", "3 h ago", "Yesterday, 18:40", or "Sat, 14 Nov" for older ones; "" without a date. */
export function newsAge(iso: string | null, now: number = Date.now()): string {
  if (!iso) return '';
  const at = Date.parse(iso);
  if (Number.isNaN(at)) return '';
  const diff = now - at;
  if (diff < MINUTE) return 'Just now';
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)} min ago`;
  if (diff < 12 * HOUR) return `${Math.floor(diff / HOUR)} h ago`;
  if (formatDay(at) === formatDay(now)) return `Today, ${formatTime(iso)}`;
  if (formatDay(at) === formatDay(now - 24 * HOUR)) return `Yesterday, ${formatTime(iso)}`;
  return formatDay(at);
}

/** "TION · 12 min ago" (just the site name when there is no date). */
export function newsMeta(sourceName: string, iso: string | null, now: number = Date.now()): string {
  const age = newsAge(iso, now);
  return age ? `${sourceName} · ${age}` : sourceName;
}
