// Response and request shapes of the Spring API. Source of truth: docs/API.md.

import type { HelpCategory } from './types.help';

export type EventCategory = 'PARTY' | 'CONCERT' | 'THEATRE' | 'SPORT' | 'GAMES' | 'FOOD' | 'ART' | 'MEETUP' | 'VOLUNTEER' | 'OTHER';

export const EVENT_CATEGORIES: EventCategory[] = [
  'PARTY',
  'CONCERT',
  'THEATRE',
  'SPORT',
  'GAMES',
  'FOOD',
  'ART',
  'MEETUP',
  'VOLUNTEER',
  'OTHER',
];

export type EventSource = 'USER' | 'EXTERNAL';

export type ParticipantStatus = 'JOINED' | 'ATTENDED' | 'NO_SHOW' | 'CANCELLED' | 'BANNED';

export type Paged<T> = { items: T[]; page: number; size: number; totalItems: number; totalPages: number };

export type UserSummary = { id: string; username: string; reliabilityScore: number };

/** A skill on a profile (PLAN 28), e.g. "Carpentry" in CARPENTRY; the category is a Help Board category. */
export type Skill = { id: string; name: string; category: HelpCategory };

/** My profile. `skills` is always sent by the API (oldest first); optional only for older cached answers. */
export type Me = UserSummary & { createdAt: string; skills?: Skill[] };

/** Public profile: attended events, the user events they organised that are already over (newest first, max 20), and skills. */
export type PublicProfile = UserSummary & {
  createdAt: string;
  attendedEvents: EventSummary[];
  organizedEvents: EventSummary[];
  skills?: Skill[];
};

export type EventSummary = {
  id: string;
  source: EventSource;
  title: string;
  category: EventCategory;
  venueName: string | null;
  lat: number | null;
  lon: number | null;
  startsAt: string;
  endsAt: string | null;
  imageUrl: string | null;
  priceMin: number | null;
  priceMax: number | null;
  capacity: number | null;
  spotsLeft: number | null;
  /** Average of the attendee reviews, 1 decimal; null when nobody reviewed yet. */
  averageRating: number | null;
  reviewCount: number;
};

export type EventDetail = EventSummary & {
  description: string | null;
  address: string | null;
  externalUrl: string | null;
  participantCount: number;
  organizer: UserSummary | null;
  myStatus: ParticipantStatus | null;
};

export type EventQuery = {
  q?: string;
  category?: string[];
  from?: string;
  to?: string;
  source?: EventSource;
  /** Map viewport `minLon,minLat,maxLon,maxLat`; events without coordinates are left out. */
  bbox?: string;
  page?: number;
  size?: number;
};

export type NewEvent = {
  title: string;
  description?: string;
  category: EventCategory;
  venueName: string;
  address?: string;
  lat: number;
  lon: number;
  startsAt: string;
  endsAt?: string;
  capacity?: number;
};

export type Participant = { user: UserSummary; status: ParticipantStatus; joinedAt: string };

export type JoinResult = { eventId: string; status: ParticipantStatus; qrToken: string };

export type LeaveResult = { status: ParticipantStatus; pointsChange: number; reliabilityScore: number };

export type Ticket = { eventId: string; qrToken: string; status: ParticipantStatus };

export type CheckInResult = { user: UserSummary; status: ParticipantStatus; pointsChange: number };

export type BanResult = { userId: string; status: ParticipantStatus };

export type UsernameAvailability = { username: string; available: boolean };

/** One attendee review of an event (1–5 stars, optional comment of at most 300 characters). */
export type Review = { reviewer: UserSummary; rating: number; comment: string | null; createdAt: string; updatedAt: string };

/**
 * Reviews of an event (GET /events/{id}/reviews). `reviewsCloseAt` is null for EXTERNAL events; `canReview` is true only
 * for a checked-in attendee (not the organiser) before the window closes; `settled` once the organiser's points were applied.
 */
export type EventReviews = {
  averageRating: number | null;
  reviewCount: number;
  reviews: Review[];
  reviewsCloseAt: string | null;
  settled: boolean;
  canReview: boolean;
  myReview: Review | null;
};

/** Body of PUT /events/{id}/reviews/me: creates or replaces my review. */
export type ReviewInput = { rating: number; comment?: string | null };

/** Longest review comment the API accepts. */
export const REVIEW_COMMENT_MAX = 300;
