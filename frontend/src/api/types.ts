// Response and request shapes of the Spring API. Source of truth: docs/API.md.

export type EventCategory = 'PARTY' | 'CONCERT' | 'THEATRE' | 'SPORT' | 'GAMES' | 'FOOD' | 'ART' | 'MEETUP' | 'OTHER';

export const EVENT_CATEGORIES: EventCategory[] = [
  'PARTY',
  'CONCERT',
  'THEATRE',
  'SPORT',
  'GAMES',
  'FOOD',
  'ART',
  'MEETUP',
  'OTHER',
];

export type EventSource = 'USER' | 'EXTERNAL';

export type ParticipantStatus = 'JOINED' | 'ATTENDED' | 'NO_SHOW' | 'CANCELLED' | 'BANNED';

export type Paged<T> = { items: T[]; page: number; size: number; totalItems: number; totalPages: number };

export type UserSummary = { id: string; username: string; reliabilityScore: number };

export type Me = UserSummary & { createdAt: string };

export type PublicProfile = UserSummary & { createdAt: string; attendedEvents: EventSummary[] };

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

export type TransitDeparture = { route: string; headsign: string; lastDepartureAt: string };

export type TransitSummary = {
  nearestStop: { id: string; name: string; distanceMeters: number } | null;
  lastDepartures: TransitDeparture[];
  activeAlerts: number;
  message: string;
};

export type TransitAlert = { id: string; title: string; description: string | null };
