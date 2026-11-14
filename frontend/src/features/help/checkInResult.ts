// Turns a help check-in answer (or error) into what the requester sees after scanning a helper (PLAN 25).
import { ApiError, friendlyError } from '@/api/errors';
import type { HelpCheckInResult } from '@/api/types.help';
import type { ScanOutcome } from '@/features/events/checkInResult';

/** Success: who helped, and the points they got. */
export function helpOutcomeFromSuccess(result: HelpCheckInResult): ScanOutcome {
  return {
    kind: 'success',
    title: `${result.user.username} helped you`,
    message: `+${result.pointsChange} civic trust for ${result.user.username} · score is now ${result.user.reliabilityScore}`,
  };
}

/** Failure: closed, wrong request and withdrawn offers are warnings; everything else is an error. */
export function helpOutcomeFromError(error: unknown): ScanOutcome {
  if (error instanceof ApiError) {
    if (error.code === 'HELP_CLOSED') return { kind: 'warning', title: 'Request already closed', message: friendlyError(error) };
    if (error.code === 'WRONG_REQUEST') return { kind: 'warning', title: 'Wrong request', message: friendlyError(error) };
    if (error.code === 'NOT_OFFERED') return { kind: 'warning', title: 'Offer withdrawn', message: 'This helper withdrew their offer.' };
    if (error.code === 'TICKET_NOT_FOUND') return { kind: 'error', title: 'Not a helper code', message: 'This QR code is not a helper code.' };
  }
  return { kind: 'error', title: 'Scan failed', message: friendlyError(error) };
}
