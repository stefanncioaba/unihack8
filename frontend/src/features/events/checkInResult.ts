// Turns a check-in answer (or error) into what the organiser sees after a scan (PLAN 13.7).
import { ApiError, friendlyError } from '@/api/errors';
import type { CheckInResult } from '@/api/types';

export type ScanOutcome = {
  kind: 'success' | 'warning' | 'error';
  title: string;
  message: string;
};

/** Success: who was checked in and the points they got. */
export function outcomeFromSuccess(result: CheckInResult): ScanOutcome {
  return {
    kind: 'success',
    title: `${result.user.username} checked in`,
    message: `+${result.pointsChange} reliability points · score is now ${result.user.reliabilityScore}`,
  };
}

/** Failure: "already scanned" and "wrong event" are warnings; everything else is an error. */
export function outcomeFromError(error: unknown): ScanOutcome {
  if (error instanceof ApiError) {
    if (error.code === 'ALREADY_CHECKED_IN') return { kind: 'warning', title: 'Already scanned', message: friendlyError(error) };
    if (error.code === 'WRONG_EVENT') return { kind: 'warning', title: 'Wrong event', message: friendlyError(error) };
    if (error.code === 'TICKET_NOT_FOUND') return { kind: 'error', title: 'Not a ticket', message: friendlyError(error) };
    if (error.code === 'BANNED') return { kind: 'error', title: 'Banned participant', message: 'This person was banned from the event.' };
  }
  return { kind: 'error', title: 'Check-in failed', message: friendlyError(error) };
}
