// Response shapes of the user endpoints added for the profile page (docs/API.md → Users).
import type { EventSummary, ParticipantStatus } from './types';

/** One event in "events I joined", with my status in it (GET /users/me/events). */
export type JoinedEvent = { event: EventSummary; status: ParticipantStatus };

/** My events: the ones I joined and the ones I organise (GET /users/me/events, PLAN 5.8). */
export type MyEvents = { joined: JoinedEvent[]; organizing: EventSummary[] };

/** Why the score changed (docs/API.md → GET /users/{id}/reliability). EVENT_RATING: the organiser's settlement from reviews (±). */
export type ReliabilityReason = 'ATTENDED' | 'NO_SHOW' | 'LATE_CANCEL' | 'EVENT_RATING';

/** One line of the reliability history. `eventId` / `eventTitle` are null when the event was deleted. */
export type ReliabilityEntry = {
  pointsChange: number;
  reason: ReliabilityReason;
  eventId: string | null;
  eventTitle: string | null;
  createdAt: string;
};

/** Score plus the 20 most recent changes (GET /users/{id}/reliability, PLAN 6.4). */
export type ReliabilityHistory = { reliabilityScore: number; entries: ReliabilityEntry[] };
