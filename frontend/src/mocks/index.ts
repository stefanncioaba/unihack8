// Mock backend: answers the same requests as the Spring API (docs/API.md) from in-memory data.
// State changes (join, leave, create, ban, check-in) persist until the app reloads.
import { ApiError } from '@/api/errors';
import type {
  CheckInResult,
  EventCategory,
  EventDetail,
  EventSummary,
  Me,
  NewEvent,
  Paged,
  Participant,
  PublicProfile,
  TransitSummary,
  UserSummary,
} from '@/api/types';
import { EVENT_CATEGORIES } from '@/api/types';

import { MOCK_ME_ID, seed, type MockEvent, type MockState } from './data';

export { MOCK_ME_ID } from './data';

type Query = Record<string, unknown>;
type Ctx = { params: string[]; query: Query; body: any };
type Route = { method: string; pattern: RegExp; handler: (ctx: Ctx) => unknown };

let state: MockState = seed();
let latencyMs = 150;

/** Restores the seed data (used by tests and by sign-out). */
export function resetMocks(): void {
  state = seed();
}

/** Changes the fake network delay; tests set it to 0. */
export function setMockLatency(ms: number): void {
  latencyMs = ms;
}

/** Test helper: direct access to the in-memory state. */
export function getMockState(): MockState {
  return state;
}

// ---- helpers ----------------------------------------------------------

/** The signed-in mock user. */
function me(): UserSummary {
  return state.users.find((u) => u.id === MOCK_ME_ID)!;
}

/** Finds a user or throws 404. */
function userById(id: string): UserSummary {
  const found = state.users.find((u) => u.id === id);
  if (!found) throw new ApiError(404, 'NOT_FOUND', 'User not found');
  return found;
}

/** Finds an event or throws 404. */
function eventById(id: string): MockEvent {
  const found = state.events.find((e) => e.id === id);
  if (!found) throw new ApiError(404, 'NOT_FOUND', 'Event not found');
  return found;
}

/** Number of people who hold a spot (JOINED or ATTENDED). */
function taken(e: MockEvent): number {
  return e.baseCount + e.participants.filter((p) => p.status === 'JOINED' || p.status === 'ATTENDED').length;
}

/** Event list shape. */
function toSummary(e: MockEvent): EventSummary {
  return {
    id: e.id,
    source: e.source,
    title: e.title,
    category: e.category,
    venueName: e.venueName,
    lat: e.lat,
    lon: e.lon,
    startsAt: e.startsAt,
    endsAt: e.endsAt,
    imageUrl: e.imageUrl,
    priceMin: e.priceMin,
    priceMax: e.priceMax,
    capacity: e.capacity,
    spotsLeft: e.capacity === null ? null : Math.max(0, e.capacity - taken(e)),
  };
}

/** Event detail shape, with my status. */
function toDetail(e: MockEvent): EventDetail {
  const mine = e.participants.find((p) => p.userId === MOCK_ME_ID);
  return {
    ...toSummary(e),
    description: e.description,
    address: e.address,
    externalUrl: e.externalUrl,
    participantCount: taken(e),
    organizer: e.organizerId ? userById(e.organizerId) : null,
    myStatus: mine && mine.status !== 'CANCELLED' ? mine.status : null,
  };
}

/** Reads a query value as a list (supports repeated keys and comma-separated values). */
function asList(value: unknown): string[] {
  if (value === undefined || value === null || value === '') return [];
  const list = Array.isArray(value) ? value : [value];
  return list.flatMap((v) => String(v).split(',')).filter(Boolean);
}

/** Reads a query value as a number, with a default. */
function asNumber(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && value !== '' && value !== undefined ? n : fallback;
}

/** Slices a list into the paged answer shape. */
function paginate<T>(all: T[], query: Query): Paged<T> {
  const page = Math.max(0, asNumber(query.page, 0));
  const size = Math.min(100, Math.max(1, asNumber(query.size, 20)));
  return {
    items: all.slice(page * size, page * size + size),
    page,
    size,
    totalItems: all.length,
    totalPages: Math.ceil(all.length / size),
  };
}

/** Throws 403 unless the signed-in mock user organises the event. */
function requireOrganizer(e: MockEvent): void {
  if (e.source === 'EXTERNAL') throw new ApiError(403, 'EXTERNAL_EVENT', 'External events cannot be managed here.');
  if (e.organizerId !== MOCK_ME_ID) throw new ApiError(403, 'NOT_ORGANIZER', 'Only the organiser can do this.');
}

/** End of an event: its end time, or 3 hours after the start (reliability rules). */
function endOf(e: MockEvent): number {
  return e.endsAt ? Date.parse(e.endsAt) : Date.parse(e.startsAt) + 3 * 3_600_000;
}

// ---- routes -----------------------------------------------------------

const routes: Route[] = [
  {
    method: 'GET',
    pattern: /^\/users\/username-available$/,
    handler: ({ query }) => {
      const username = String(query.username ?? '');
      if (!/^[A-Za-z0-9_]{3,20}$/.test(username)) {
        throw new ApiError(400, 'INVALID_USERNAME', 'Use 3–20 letters, digits or underscores.');
      }
      const taken = state.users.some((u) => u.username.toLowerCase() === username.toLowerCase());
      return { username, available: !taken };
    },
  },
  {
    method: 'GET',
    pattern: /^\/users\/me$/,
    handler: (): Me => ({ ...me(), createdAt: state.createdAt[MOCK_ME_ID] }),
  },
  {
    method: 'GET',
    pattern: /^\/users\/search$/,
    handler: ({ query }): UserSummary[] => {
      const q = String(query.q ?? '').trim().toLowerCase();
      if (!q) return [];
      return state.users.filter((u) => u.username.toLowerCase().startsWith(q)).slice(0, 20);
    },
  },
  {
    method: 'GET',
    pattern: /^\/users\/([^/]+)$/,
    handler: ({ params }): PublicProfile => {
      const user = userById(params[0]);
      const attendedEvents = (state.attended[user.id] ?? []).map((id) => toSummary(eventById(id)));
      return { ...user, createdAt: state.createdAt[user.id], attendedEvents };
    },
  },
  {
    method: 'GET',
    pattern: /^\/events$/,
    handler: ({ query }): Paged<EventSummary> => {
      const q = String(query.q ?? '').trim().toLowerCase();
      const categories = asList(query.category);
      const from = query.from ? Date.parse(String(query.from)) : Date.now();
      const to = query.to ? Date.parse(String(query.to)) : Infinity;
      const source = query.source ? String(query.source) : null;
      const list = state.events
        .filter((e) => Date.parse(e.startsAt) >= from && Date.parse(e.startsAt) < to)
        .filter((e) => !q || e.title.toLowerCase().includes(q))
        .filter((e) => categories.length === 0 || categories.includes(e.category))
        .filter((e) => !source || e.source === source)
        .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt))
        .map(toSummary);
      return paginate(list, query);
    },
  },
  {
    method: 'POST',
    pattern: /^\/events$/,
    handler: ({ body }): EventDetail => {
      const b = (body ?? {}) as Partial<NewEvent>;
      const fields: Record<string, string> = {};
      if (!b.title || !b.title.trim()) fields.title = 'must not be blank';
      if (!b.category || !EVENT_CATEGORIES.includes(b.category as EventCategory)) fields.category = 'is not a valid category';
      if (!b.venueName?.trim()) fields.venueName = 'must not be blank';
      if (typeof b.lat !== 'number' || typeof b.lon !== 'number') fields.lat = 'location is required';
      if (!b.startsAt || Date.parse(b.startsAt) <= Date.now()) fields.startsAt = 'must be in the future';
      if (b.capacity !== undefined && b.capacity !== null && b.capacity < 1) fields.capacity = 'must be at least 1';
      if (Object.keys(fields).length) throw new ApiError(400, 'VALIDATION_FAILED', 'Invalid event.', fields);

      const created: MockEvent = {
        id: `e0000000-0000-4000-8000-${String(Date.now()).slice(-12).padStart(12, '0')}`,
        source: 'USER',
        title: b.title!.trim(),
        description: b.description?.trim() || null,
        category: b.category as EventCategory,
        venueName: b.venueName?.trim() || null,
        address: b.address?.trim() || null,
        lat: b.lat!,
        lon: b.lon!,
        startsAt: b.startsAt!,
        endsAt: b.endsAt ?? null,
        imageUrl: null,
        priceMin: null,
        priceMax: null,
        externalUrl: null,
        capacity: b.capacity ?? null,
        baseCount: 0,
        organizerId: MOCK_ME_ID,
        participants: [],
      };
      state.events.push(created);
      return toDetail(created);
    },
  },
  { method: 'GET', pattern: /^\/events\/([^/]+)$/, handler: ({ params }) => toDetail(eventById(params[0])) },
  {
    method: 'POST',
    pattern: /^\/events\/([^/]+)\/join$/,
    handler: ({ params }) => {
      const e = eventById(params[0]);
      if (e.source === 'EXTERNAL') throw new ApiError(403, 'EXTERNAL_EVENT', 'External events cannot be joined.');
      if (e.organizerId === MOCK_ME_ID) throw new ApiError(409, 'IS_ORGANIZER', 'You organise this event.');
      if (endOf(e) < Date.now()) throw new ApiError(409, 'EVENT_ENDED', 'This event is over.');
      const mine = e.participants.find((p) => p.userId === MOCK_ME_ID);
      if (mine?.status === 'BANNED') throw new ApiError(403, 'BANNED', 'You are banned from this event.');
      if (mine && mine.status !== 'CANCELLED') throw new ApiError(409, 'ALREADY_JOINED', 'You already joined.');
      if (e.capacity !== null && taken(e) >= e.capacity) throw new ApiError(409, 'EVENT_FULL', 'No free spots left.');
      if (mine) {
        mine.status = 'JOINED';
        return { eventId: e.id, status: 'JOINED', qrToken: mine.qrToken };
      }
      const qrToken = `mock-ticket-${e.id.slice(-4)}-${Math.random().toString(36).slice(2, 10)}`;
      e.participants.push({ userId: MOCK_ME_ID, status: 'JOINED', joinedAt: new Date().toISOString(), qrToken });
      return { eventId: e.id, status: 'JOINED', qrToken };
    },
  },
  {
    method: 'DELETE',
    pattern: /^\/events\/([^/]+)\/join$/,
    handler: ({ params }) => {
      const e = eventById(params[0]);
      const mine = e.participants.find((p) => p.userId === MOCK_ME_ID);
      if (!mine || mine.status === 'CANCELLED' || mine.status === 'BANNED') {
        throw new ApiError(409, 'NOT_JOINED', 'You have not joined this event.');
      }
      if (endOf(e) < Date.now()) throw new ApiError(409, 'EVENT_ENDED', 'This event is over.');
      const late = Date.parse(e.startsAt) - Date.now() < 2 * 3_600_000;
      const pointsChange = late ? -2 : 0;
      mine.status = 'CANCELLED';
      const user = me();
      user.reliabilityScore = Math.max(0, user.reliabilityScore + pointsChange);
      return { status: 'CANCELLED', pointsChange, reliabilityScore: user.reliabilityScore };
    },
  },
  {
    method: 'GET',
    pattern: /^\/events\/([^/]+)\/participants$/,
    handler: ({ params }): Participant[] =>
      eventById(params[0])
        .participants.filter((p) => p.status !== 'CANCELLED')
        .sort((a, b) => Date.parse(a.joinedAt) - Date.parse(b.joinedAt))
        .map((p) => ({ user: userById(p.userId), status: p.status, joinedAt: p.joinedAt })),
  },
  {
    method: 'POST',
    pattern: /^\/events\/([^/]+)\/participants\/([^/]+)\/ban$/,
    handler: ({ params }) => {
      const e = eventById(params[0]);
      requireOrganizer(e);
      const target = e.participants.find((p) => p.userId === params[1]);
      if (!target) throw new ApiError(404, 'NOT_FOUND', 'Participant not found');
      target.status = 'BANNED';
      return { userId: target.userId, status: 'BANNED' };
    },
  },
  {
    method: 'GET',
    pattern: /^\/events\/([^/]+)\/my-ticket$/,
    handler: ({ params }) => {
      const e = eventById(params[0]);
      const mine = e.participants.find((p) => p.userId === MOCK_ME_ID);
      if (mine?.status === 'BANNED') throw new ApiError(403, 'BANNED', 'You are banned from this event.');
      if (!mine || mine.status === 'CANCELLED') throw new ApiError(409, 'NOT_JOINED', 'You have not joined this event.');
      return { eventId: e.id, qrToken: mine.qrToken, status: mine.status };
    },
  },
  {
    method: 'POST',
    pattern: /^\/events\/([^/]+)\/check-in$/,
    handler: ({ params, body }): CheckInResult => {
      const e = eventById(params[0]);
      requireOrganizer(e);
      const token = String(body?.token ?? '');
      const owner = state.events.flatMap((ev) => ev.participants.map((p) => ({ ev, p }))).find((x) => x.p.qrToken === token);
      if (!owner) throw new ApiError(404, 'TICKET_NOT_FOUND', 'This QR code is not a ticket.');
      if (owner.ev.id !== e.id) throw new ApiError(409, 'WRONG_EVENT', 'Ticket belongs to another event.');
      if (owner.p.status === 'BANNED') throw new ApiError(403, 'BANNED', 'This participant is banned.');
      if (owner.p.status === 'ATTENDED') throw new ApiError(409, 'ALREADY_CHECKED_IN', 'Already scanned.');
      if (endOf(e) < Date.now()) throw new ApiError(409, 'EVENT_ENDED', 'This event is over.');
      owner.p.status = 'ATTENDED';
      const user = userById(owner.p.userId);
      user.reliabilityScore += 5;
      state.attended[user.id] = [e.id, ...(state.attended[user.id] ?? [])];
      return { user: { ...user }, status: 'ATTENDED', pointsChange: 5 };
    },
  },
  {
    method: 'GET',
    pattern: /^\/transit\/summary$/,
    handler: (): TransitSummary => ({
      nearestStop: { id: '1', name: 'Dâmbovița (Ion Barac)', distanceMeters: 230 },
      lastDepartures: [{ route: '2', headsign: 'Shopping City', lastDepartureAt: '2026-11-14T21:41:00Z' }],
      activeAlerts: state.alerts.length,
      message: 'Last tram 2 from Dâmbovița (Ion Barac) leaves at 23:41',
    }),
  },
  { method: 'GET', pattern: /^\/transit\/alerts$/, handler: () => state.alerts },
];

/** Entry point used by the API client when USE_MOCKS is on. */
export async function mockRequest(method: string, path: string, query: Query = {}, body?: unknown): Promise<unknown> {
  if (latencyMs > 0) await new Promise((resolve) => setTimeout(resolve, latencyMs));
  for (const route of routes) {
    if (route.method !== method) continue;
    const match = route.pattern.exec(path);
    if (match) return structuredCloneSafe(route.handler({ params: match.slice(1), query, body }));
  }
  throw new ApiError(404, 'NOT_FOUND', `No mock for ${method} ${path}`);
}

/** Deep copy so screens can never mutate the mock state through a response. */
function structuredCloneSafe<T>(value: T): T {
  return value === undefined ? value : (JSON.parse(JSON.stringify(value)) as T);
}
