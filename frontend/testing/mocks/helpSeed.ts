// Seed data for the mock Neighbour Help Board (docs/API.md → PLAN 25). Times are relative to "now".
// Demo helper codes are deterministic (`demo-help-ticket-…`) so the scan screen can be tried by hand.
import type { HelpCategory, HelpOfferStatus, HelpStatus } from '@/api/types.help';

export type MockHelpOffer = { userId: string; status: HelpOfferStatus; offeredAt: string; qrToken: string };

export type MockHelpRequest = {
  id: string;
  title: string;
  description: string | null;
  category: HelpCategory;
  address: string | null;
  lat: number | null;
  lon: number | null;
  requesterId: string;
  /** Stored status; an OPEN request past `expiresAt` is reported as EXPIRED. */
  status: HelpStatus;
  createdAt: string;
  expiresAt: string;
  closedAt: string | null;
  offers: MockHelpOffer[];
};

/** Stable fake id for the Nth seeded help request. */
export const helpRequestId = (n: number) => `d0000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

/** UTC ISO time `minutes` minutes before now. */
function minutesAgo(minutes: number): string {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

/** Builds the seeded requests; `ids` are the mock users (me = demo_user). */
export function seedHelpRequests(ids: { me: string; stefan: string; stella: string; andrei: string; maria: string }): MockHelpRequest[] {
  /** Shorthand for an offer made `minutes` ago. */
  const offer = (userId: string, status: HelpOfferStatus, qrToken: string, minutes: number): MockHelpOffer => ({
    userId,
    status,
    qrToken,
    offeredAt: minutesAgo(minutes),
  });

  /** Shorthand for a request posted `minutes` ago (open for 24 h). */
  const request = (
    n: number,
    title: string,
    category: HelpCategory,
    requesterId: string,
    minutes: number,
    place: { address: string | null; lat: number | null; lon: number | null },
    offers: MockHelpOffer[] = [],
    description: string | null = null,
  ): MockHelpRequest => ({
    id: helpRequestId(n),
    title,
    description,
    category,
    ...place,
    requesterId,
    status: 'OPEN',
    createdAt: minutesAgo(minutes),
    expiresAt: new Date(Date.parse(minutesAgo(minutes)) + 24 * 3_600_000).toISOString(),
    closedAt: null,
    offers,
  });

  return [
    request(1, 'Borrow a ladder for 30 minutes', 'BORROW', ids.stefan, 60, { address: 'Strada Paris 12', lat: 45.7489, lon: 21.2318 }, [
      offer(ids.stella, 'OFFERED', 'demo-help-ticket-stella-1', 40),
    ], 'Changing a bulb in the hallway.'),
    // Mine: two helpers to choose from, and one who withdrew.
    request(
      2,
      'Help carrying a sofa to the 3rd floor',
      'CARRY',
      ids.me,
      120,
      { address: 'Strada Mărășești 5', lat: 45.7558, lon: 21.2292 },
      [
        offer(ids.stella, 'OFFERED', 'demo-help-ticket-stella', 100),
        offer(ids.maria, 'WITHDRAWN', 'demo-help-ticket-maria', 90),
        offer(ids.andrei, 'OFFERED', 'demo-help-ticket-andrei', 80),
      ],
      'No lift in the building. Takes about 15 minutes.',
    ),
    // I offered here: my helper code is demo-help-ticket-me-3.
    request(3, 'Walk my dog this evening', 'PETS', ids.andrei, 30, { address: 'Parcul Rozelor', lat: 45.7507, lon: 21.2297 }, [
      offer(ids.me, 'OFFERED', 'demo-help-ticket-me-3', 20),
    ]),
    request(4, 'Pick up a parcel from the post office', 'ERRANDS', ids.stella, 300, { address: null, lat: null, lon: null }),
    request(5, 'Fix a wobbly bike brake', 'REPAIRS', ids.maria, 180, { address: 'Piața Victoriei', lat: 45.7537, lon: 21.2251 }),
    // Posted 25 hours ago and never closed: expired, hidden from the board.
    request(6, 'Water my plants while I am away', 'OTHER', ids.andrei, 25 * 60, { address: 'Strada Alba Iulia 2', lat: 45.7537, lon: 21.2257 }, [
      offer(ids.stella, 'OFFERED', 'demo-help-ticket-stella-6', 24 * 60),
    ]),
    // Closed earlier today: andrei was scanned first, my offer was not needed.
    {
      ...request(7, 'Carry groceries from the market', 'CARRY', ids.stefan, 360, { address: 'Piața 700', lat: 45.7598, lon: 21.2239 }, [
        offer(ids.me, 'NOT_NEEDED', 'demo-help-ticket-me-7', 340),
        offer(ids.andrei, 'HELPED', 'demo-help-ticket-andrei-7', 330),
      ]),
      status: 'HELPED',
      closedAt: minutesAgo(240),
    },
  ];
}
