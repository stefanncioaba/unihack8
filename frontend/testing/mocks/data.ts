// Seed data for the mock backend. Shapes follow docs/API.md. Dates are relative to "now"
// so the demo always shows upcoming events.
import type { EventCategory, EventSource, ParticipantStatus, UserSummary } from '@/api/types';
import type { TransitAlert } from '@/api/types.transit';
import type { ReliabilityEntry } from '@/api/types.users';
import { bucharestToUtcIso, toBucharest } from '@/lib/time';

export const MOCK_ME_ID = '11111111-1111-4111-8111-111111111111';

export type MockParticipant = { userId: string; status: ParticipantStatus; joinedAt: string; qrToken: string };

export type MockEvent = {
  id: string;
  source: EventSource;
  title: string;
  description: string | null;
  category: EventCategory;
  venueName: string | null;
  address: string | null;
  lat: number | null;
  lon: number | null;
  startsAt: string;
  endsAt: string | null;
  imageUrl: string | null;
  priceMin: number | null;
  priceMax: number | null;
  externalUrl: string | null;
  capacity: number | null;
  /** People already inside who are not modelled as users (so lists stay short). */
  baseCount: number;
  organizerId: string | null;
  participants: MockParticipant[];
};

/** One attendee review (docs/API.md → GET /events/{id}/reviews). */
export type MockReview = { userId: string; rating: number; comment: string | null; createdAt: string; updatedAt: string };

export type MockState = {
  users: UserSummary[];
  createdAt: Record<string, string>;
  events: MockEvent[];
  attended: Record<string, string[]>;
  /** Reliability history per user id, newest first (docs/API.md → GET /users/{id}/reliability). */
  reliabilityLog: Record<string, ReliabilityEntry[]>;
  alerts: TransitAlert[];
  /** Reviews per event id. */
  reviews: Record<string, MockReview[]>;
  /** Event ids whose organiser rating was already applied (settled once, 24 h after the end). */
  settled: string[];
};

/** Bucharest wall-clock `hour:minute` on the day `days` from now, as a UTC ISO string. */
function at(days: number, hour: number, minute = 0): string {
  const t = toBucharest(Date.now());
  const d = new Date(Date.UTC(t.year, t.month - 1, t.day + days));
  return bucharestToUtcIso({ year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate(), hour, minute });
}

/** UTC ISO time `hours` hours before now. */
function hoursAgo(hours: number): string {
  return new Date(Date.now() - hours * 3_600_000).toISOString();
}

/** Stable fake id for the Nth seeded event. */
const eventId = (n: number) => `e0000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

/** Stable fake id for a seeded user. */
const userId = (n: number) => `${n}${n}${n}${n}${n}${n}${n}${n}-${n}${n}${n}${n}-4${n}${n}${n}-8${n}${n}${n}-${String(n).repeat(12)}`;

export const USER_IDS = { me: MOCK_ME_ID, stefan: userId(2), stella: userId(3), andrei: userId(4), maria: userId(5) };

/** Builds a fresh copy of all seed data. */
export function seed(): MockState {
  const users: UserSummary[] = [
    { id: USER_IDS.me, username: 'demo_user', reliabilityScore: 100 },
    { id: USER_IDS.stefan, username: 'stefan', reliabilityScore: 115 },
    { id: USER_IDS.stella, username: 'stella_99', reliabilityScore: 90 },
    { id: USER_IDS.andrei, username: 'andrei_tm', reliabilityScore: 105 },
    { id: USER_IDS.maria, username: 'maria_c', reliabilityScore: 62 },
  ];

  /** Shorthand for a seeded participant. */
  const p = (user: string, status: ParticipantStatus, token: string): MockParticipant => ({
    userId: user,
    status,
    joinedAt: at(-1, 18),
    qrToken: token,
  });

  /** Shorthand for an imported (EXTERNAL) event. */
  const external = (
    n: number,
    title: string,
    category: EventCategory,
    venue: string,
    when: string,
    price: [number, number] | null,
    lat: number,
    lon: number,
  ): MockEvent => ({
    id: eventId(n),
    source: 'EXTERNAL',
    title,
    description: 'Tickets are sold on the organiser’s website. Doors open one hour before the start.',
    category,
    venueName: venue,
    address: 'Timișoara',
    lat,
    lon,
    startsAt: when,
    endsAt: null,
    imageUrl: null,
    priceMin: price ? price[0] : null,
    priceMax: price ? price[1] : null,
    externalUrl: 'https://www.livetickets.ro',
    capacity: null,
    baseCount: 0,
    organizerId: null,
    participants: [],
  });

  /** Shorthand for a user-created event. */
  const user = (
    n: number,
    title: string,
    category: EventCategory,
    organizerId: string,
    capacity: number | null,
    baseCount: number,
    when: string,
    venue: string,
    lat: number,
    lon: number,
    participants: MockParticipant[] = [],
  ): MockEvent => ({
    id: eventId(n),
    source: 'USER',
    title,
    description: 'Come along and bring a friend. Everyone is welcome.',
    category,
    venueName: venue,
    address: 'Timișoara',
    lat,
    lon,
    startsAt: when,
    endsAt: null,
    imageUrl: null,
    priceMin: null,
    priceMax: null,
    externalUrl: null,
    capacity,
    baseCount,
    organizerId,
    participants,
  });

  const events: MockEvent[] = [
    {
      ...user(1, 'Board games night', 'GAMES', USER_IDS.stefan, 12, 6, at(1, 19), 'Scârț Loc Lejer', 45.7489, 21.2318, [
        p(USER_IDS.stella, 'JOINED', 'demo-ticket-stella-1'),
        p(USER_IDS.andrei, 'JOINED', 'demo-ticket-andrei-1'),
      ]),
      description: 'Bring your favourite game. Beginners welcome.',
      address: 'Strada Mărășești 1',
    },
    user(2, 'Sunset run by the Bega', 'SPORT', MOCK_ME_ID, 20, 0, at(2, 18), 'Parcul Rozelor', 45.7507, 21.2297, [
      p(USER_IDS.stella, 'JOINED', 'demo-ticket-stella'),
      p(USER_IDS.andrei, 'JOINED', 'demo-ticket-andrei'),
      p(USER_IDS.maria, 'JOINED', 'demo-ticket-maria'),
    ]),
    user(3, 'Picnic in the Botanical Park', 'MEETUP', USER_IDS.stella, 6, 5, at(3, 12), 'Parcul Botanic', 45.7365, 21.2402, [
      p(USER_IDS.andrei, 'JOINED', 'demo-ticket-andrei-3'),
    ]),
    external(4, 'Indie rock night', 'CONCERT', 'Berăria H', at(1, 21), [60, 120], 45.7554, 21.2178),
    external(5, 'Street food weekend', 'FOOD', 'Piața Libertății', at(4, 12), null, 45.7596, 21.2299),
    external(6, 'Cyrano de Bergerac', 'THEATRE', 'Teatrul Național Timișoara', at(5, 19), [40, 80], 45.7539, 21.2257),
    user(7, 'Art walk through the old town', 'ART', USER_IDS.andrei, null, 0, at(1, 16), 'Piața Unirii', 45.7585, 21.2292, [
      p(MOCK_ME_ID, 'JOINED', 'demo-ticket-me-7'),
    ]),
    external(8, 'Karaoke night', 'PARTY', 'Club Daos', at(2, 22), [20, 20], 45.7527, 21.2263),
    external(9, 'Jazz in the park', 'CONCERT', 'Parcul Rozelor', at(3, 18, 30), [0, 0], 45.7507, 21.2297),
    user(10, 'Pub quiz: general knowledge', 'GAMES', USER_IDS.stefan, 30, 12, at(4, 20), 'Beer O’Clock', 45.7528, 21.2243),
    user(11, 'Yoga at sunrise', 'SPORT', USER_IDS.stella, 15, 4, at(6, 7), 'Parcul Central', 45.7541, 21.2352),
    user(12, 'Language exchange', 'MEETUP', USER_IDS.andrei, null, 0, at(2, 19), 'Café Central', 45.7552, 21.2285),
    external(13, 'Vinyl party', 'PARTY', 'Fabrica', at(5, 23), [30, 50], 45.7473, 21.2412),
    external(14, 'Stand-up comedy show', 'THEATRE', 'Sala Capitol', at(6, 20), [70, 110], 45.7561, 21.2271),
    // Past events: hidden from lists, used for the "attended" history of profiles.
    user(101, 'Autumn photo walk', 'ART', USER_IDS.stefan, 10, 0, at(-10, 15), 'Parcul Rozelor', 45.7507, 21.2297, [
      { ...p(MOCK_ME_ID, 'ATTENDED', 'demo-ticket-me-101'), joinedAt: at(-11, 18) },
    ]),
    user(102, 'Retro gaming evening', 'GAMES', USER_IDS.andrei, 10, 0, at(-5, 19), 'Scârț Loc Lejer', 45.7489, 21.2318, [
      { ...p(MOCK_ME_ID, 'ATTENDED', 'demo-ticket-me-102'), joinedAt: at(-6, 18) },
    ]),
    user(103, 'Open mic night', 'ART', USER_IDS.andrei, 25, 3, at(-3, 20), 'Café Central', 45.7552, 21.2285, [
      { ...p(MOCK_ME_ID, 'NO_SHOW', 'demo-ticket-me-103'), joinedAt: at(-4, 18) },
    ]),
    // Ended a couple of hours ago: reviews are still open, and I was checked in, so I can rate it.
    {
      ...user(104, 'Coffee cupping morning', 'FOOD', USER_IDS.stefan, 8, 0, hoursAgo(5), 'Café Central', 45.7552, 21.2285, [
        { ...p(MOCK_ME_ID, 'ATTENDED', 'demo-ticket-me-104'), joinedAt: at(-2, 18) },
        { ...p(USER_IDS.stella, 'ATTENDED', 'demo-ticket-stella-104'), joinedAt: at(-2, 18) },
        { ...p(USER_IDS.andrei, 'ATTENDED', 'demo-ticket-andrei-104'), joinedAt: at(-2, 18) },
      ]),
      description: 'Taste four single-origin coffees and learn how to brew them.',
    },
    // Organised by me, over and settled: shows my past event with its reviews.
    user(105, 'Sushi rolling workshop', 'FOOD', MOCK_ME_ID, 6, 0, at(-3, 18), 'Parcul Rozelor', 45.7507, 21.2297, [
      { ...p(USER_IDS.stella, 'ATTENDED', 'demo-ticket-stella-105'), joinedAt: at(-4, 18) },
      { ...p(USER_IDS.andrei, 'ATTENDED', 'demo-ticket-andrei-105'), joinedAt: at(-4, 18) },
    ]),
  ];

  const attended: Record<string, string[]> = {
    [USER_IDS.me]: [eventId(102), eventId(101)],
    [USER_IDS.stella]: [eventId(101), eventId(102)],
    [USER_IDS.stefan]: [eventId(101)],
    [USER_IDS.andrei]: [eventId(102)],
  };

  /** Reliability history: +5 for every attended event, plus my one no-show (net zero for me: 100 stays 100). */
  const reliabilityLog: Record<string, ReliabilityEntry[]> = Object.fromEntries(
    Object.entries(attended).map(([uid, ids]) => [
      uid,
      ids.map((id) => {
        const ev = events.find((e) => e.id === id)!;
        return { pointsChange: 5, reason: 'ATTENDED' as const, eventId: ev.id, eventTitle: ev.title, createdAt: ev.endsAt ?? ev.startsAt };
      }),
    ]),
  );
  const noShow = events.find((e) => e.id === eventId(103))!;
  reliabilityLog[USER_IDS.me] = [
    { pointsChange: -10, reason: 'NO_SHOW', eventId: noShow.id, eventTitle: noShow.title, createdAt: noShow.startsAt },
    ...reliabilityLog[USER_IDS.me],
  ];

  /** Shorthand for a seeded review written at `when`. */
  const review = (userId: string, rating: number, comment: string | null, when: string): MockReview => ({
    userId,
    rating,
    comment,
    createdAt: when,
    updatedAt: when,
  });
  const reviews: Record<string, MockReview[]> = {
    [eventId(104)]: [
      review(USER_IDS.stella, 5, 'Lovely people and great coffee.', hoursAgo(1)),
      review(USER_IDS.andrei, 4, null, hoursAgo(1.5)),
    ],
    [eventId(105)]: [
      review(USER_IDS.stella, 5, 'Best workshop this autumn!', at(-3, 22)),
      review(USER_IDS.andrei, 4, 'Fun, a bit crowded.', at(-3, 21)),
    ],
  };

  return {
    users,
    createdAt: Object.fromEntries(users.map((u) => [u.id, '2026-11-13T15:20:00Z'])),
    events,
    attended,
    reliabilityLog,
    alerts: [
      {
        id: 'A155',
        title: 'Tram traffic diverted in Piața Traian',
        description: 'Until the end of the year, trams run on diverted routes. Check the line map for the new stops.',
      },
    ],
    reviews,
    // The workshop was settled before the seed (its reliability entry is left out to keep the seeded history short).
    settled: [eventId(105)],
  };
}
