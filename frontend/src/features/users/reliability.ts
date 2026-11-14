// Labels for the civic trust score (the reliability score) rules and history (rules agreed in PLAN 1.7, shape in docs/API.md).
import type { ReliabilityReason } from '@/api/types.users';

/** The score rules shown in the "How it works" panel; keep in sync with DOCS.md → "Reliability rules". */
export const RELIABILITY_RULES: { points: number; text: string }[] = [
  { points: 5, text: 'Checked in at an event you joined' },
  { points: 5, text: 'Bonus for a volunteer action (cleanups, food drives)' },
  { points: -10, text: 'Missed an event you joined' },
  { points: -2, text: 'Left less than 2 hours before the start' },
];

/** Score every new account starts with. */
export const START_SCORE = 100;

/** `+5` / `−10` with a real minus sign. */
export function formatPoints(points: number): string {
  return points > 0 ? `+${points}` : points < 0 ? `−${Math.abs(points)}` : '0';
}

/** Human label of a history reason. */
export function reasonLabel(reason: ReliabilityReason): string {
  switch (reason) {
    case 'ATTENDED':
      return 'Attended';
    case 'NO_SHOW':
      return 'Missed the event';
    case 'LATE_CANCEL':
      return 'Left late';
    case 'EVENT_RATING':
      return 'Event rating';
    case 'VOLUNTEER_BONUS':
      return 'Volunteer bonus';
  }
}
