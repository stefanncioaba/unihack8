// Text helpers for the Help Board: ages, expiry, offer counts and status labels.
import { HELP_POINTS, type HelpCategory, type HelpOfferStatus, type HelpRequestDetail, type HelpRequestSummary, type HelpTicket } from '@/api/types.help';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

/** "Just now", "12 min ago", "3 h ago" or "2 d ago". */
export function timeAgo(iso: string, now: number = Date.now()): string {
  const ms = now - Date.parse(iso);
  if (ms < MINUTE) return 'Just now';
  if (ms < HOUR) return `${Math.floor(ms / MINUTE)} min ago`;
  if (ms < 24 * HOUR) return `${Math.floor(ms / HOUR)} h ago`;
  return `${Math.floor(ms / (24 * HOUR))} d ago`;
}

/** "Expires in 23 h", "Expires in 40 min" or "Expired". */
export function expiresIn(iso: string, now: number = Date.now()): string {
  const ms = Date.parse(iso) - now;
  if (ms <= 0) return 'Expired';
  if (ms < HOUR) return `Expires in ${Math.max(1, Math.floor(ms / MINUTE))} min`;
  return `Expires in ${Math.floor(ms / HOUR)} h`;
}

/** "No offers yet", "1 offer", "3 offers". */
export function offersLabel(count: number): string {
  if (count === 0) return 'No offers yet';
  return `${count} ${count === 1 ? 'offer' : 'offers'}`;
}

/** Short status for chips: "Open", "Helped", "Cancelled", "Expired". */
export function statusLabel(r: Pick<HelpRequestSummary, 'status'>): string {
  switch (r.status) {
    case 'OPEN':
      return 'Open';
    case 'HELPED':
      return 'Helped';
    case 'CANCELLED':
      return 'Cancelled';
    case 'EXPIRED':
      return 'Expired';
  }
}

/** Status line of the detail screen: "Open · expires in 23 h", "Helped by stella_99", "Cancelled", "Expired". */
export function statusLine(r: Pick<HelpRequestDetail, 'status' | 'helper' | 'expiresAt'>, now: number = Date.now()): string {
  if (r.status === 'HELPED') return r.helper ? `Helped by ${r.helper.username}` : 'Helped';
  if (r.status === 'OPEN') return Date.parse(r.expiresAt) > now ? `Open · ${expiresIn(r.expiresAt, now).toLowerCase()}` : 'Expired';
  return statusLabel(r);
}

/** Label for my own offer on a card, or null when there is nothing to say. */
export function myOfferLabel(status: HelpOfferStatus | null): string | null {
  switch (status) {
    case 'OFFERED':
      return 'You offered';
    case 'HELPED':
      return `You helped · +${HELP_POINTS}`;
    case 'NOT_NEEDED':
      return 'Not needed';
    default:
      return null;
  }
}

/** Keeps the requests of the chosen categories (all when none is chosen). */
export function filterByCategory<T extends Pick<HelpRequestSummary, 'category'>>(list: T[], categories: HelpCategory[]): T[] {
  return categories.length === 0 ? list : list.filter((r) => categories.includes(r.category));
}

/** Chip and explanation for each ticket state; `closed` = the request ended without me being scanned. */
export function ticketState(status: HelpTicket['status'], requester: string, closed: boolean) {
  if (status === 'HELPED') {
    return { chip: `You helped · +${HELP_POINTS}`, tone: 'signal' as const, text: `You helped ${requester}. +${HELP_POINTS} civic trust points were added to your score.` };
  }
  if (status === 'NOT_NEEDED') {
    return { chip: 'Not needed', tone: 'muted' as const, text: 'Someone else helped first. Thanks for offering!' };
  }
  if (closed) {
    return { chip: 'Closed', tone: 'muted' as const, text: 'This request was cancelled or expired. No points change.' };
  }
  return {
    chip: 'Offered',
    tone: 'signal' as const,
    text: `Show this code to ${requester} when you meet. When they scan it you get +${HELP_POINTS} civic trust points.`,
  };
}
