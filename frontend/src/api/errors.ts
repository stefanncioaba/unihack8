// Error type of the API client (also thrown by the test-only mock backend), plus human-friendly messages per error code.

/** An error answer from the API (or a network failure, status 0). `code` is stable, `message` is for people. */
export class ApiError extends Error {
  status: number;
  code: string;
  fields: Record<string, string> | null;

  constructor(status: number, code: string, message: string, fields: Record<string, string> | null = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

/** Messages shown to users, by API error code (codes are listed in docs/API.md). */
const FRIENDLY: Record<string, string> = {
  NETWORK: 'Cannot reach the server. Check your Wi-Fi and the backend address.',
  TIMEOUT: 'The server took too long to answer. Try again.',
  NOT_CONFIGURED: 'The app has no backend address. Set EXPO_PUBLIC_API_URL in frontend/.env.',
  UNAUTHORIZED: 'Your session expired. Please sign in again.',
  NOT_ORGANIZER: 'Only the organiser can do this.',
  BANNED: 'The organiser banned you from this event.',
  EXTERNAL_EVENT: 'Tickets for this event are sold on the organiser’s website.',
  NOT_FOUND: 'We could not find that.',
  TICKET_NOT_FOUND: 'This QR code is not a ticket.',
  USERNAME_TAKEN: 'That username is already taken.',
  INVALID_USERNAME: 'Use 3–20 letters, digits or underscores.',
  EVENT_FULL: 'This event has no free spots left.',
  ALREADY_JOINED: 'You already joined this event.',
  IS_ORGANIZER: 'You organise this event.',
  EVENT_ENDED: 'This event is over.',
  NOT_JOINED: 'You have not joined this event.',
  WRONG_EVENT: 'This ticket belongs to a different event.',
  ALREADY_CHECKED_IN: 'This ticket was already scanned.',
  RATE_LIMITED: 'Too many requests. Try again in a minute.',
  SOURCE_UNAVAILABLE: 'Live data is temporarily unavailable.',
  INTERNAL_ERROR: 'Something went wrong on our side. Try again.',
};

/** Turns any thrown value into a message that is safe to show to a user. */
export function friendlyError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === 'VALIDATION_FAILED' && error.fields) {
      const first = Object.entries(error.fields)[0];
      if (first) return `${first[0]}: ${first[1]}`;
    }
    return FRIENDLY[error.code] ?? error.message ?? 'Something went wrong.';
  }
  if (error instanceof Error && error.message) return error.message;
  return 'Something went wrong.';
}
