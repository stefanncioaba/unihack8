// Shared core of the mock backend: the in-memory state and the helpers every routes file uses.
// Each area (events, users, transit, places, routing, ai) keeps its routes in `routes/<area>.ts`.
import { ApiError } from '@/api/errors';
import type { EventDetail, EventSummary, Paged, UserSummary } from '@/api/types';

import { MOCK_ME_ID, seed, type MockEvent, type MockState } from './data';

export type Query = Record<string, unknown>;
export type Ctx = { params: string[]; query: Query; body: any };
export type Route = { method: string; pattern: RegExp; handler: (ctx: Ctx) => unknown };

let state: MockState = seed();
let latencyMs = 150;

/** The current in-memory state (always call this: `resetMocks` replaces the object). */
export function getState(): MockState {
  return state;
}

/** Restores the seed data (used by tests and by sign-out). */
export function resetMocks(): void {
  state = seed();
}

/** Changes the fake network delay; tests set it to 0. */
export function setMockLatency(ms: number): void {
  latencyMs = ms;
}

/** The current fake network delay in milliseconds. */
export function getMockLatency(): number {
  return latencyMs;
}

// ---- helpers ----------------------------------------------------------

// ---- helpers ----------------------------------------------------------

/** The signed-in mock user. */
export function me(): UserSummary {
  return getState().users.find((u) => u.id === MOCK_ME_ID)!;
}

/** Finds a user or throws 404. */
export function userById(id: string): UserSummary {
  const found = getState().users.find((u) => u.id === id);
  if (!found) throw new ApiError(404, 'NOT_FOUND', 'User not found');
  return found;
}

/** Finds an event or throws 404. */
export function eventById(id: string): MockEvent {
  const found = getState().events.find((e) => e.id === id);
  if (!found) throw new ApiError(404, 'NOT_FOUND', 'Event not found');
  return found;
}

/** Number of people who hold a spot (JOINED or ATTENDED). */
export function taken(e: MockEvent): number {
  return e.baseCount + e.participants.filter((p) => p.status === 'JOINED' || p.status === 'ATTENDED').length;
}

/** Event list shape. */
export function toSummary(e: MockEvent): EventSummary {
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
export function toDetail(e: MockEvent): EventDetail {
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
export function asList(value: unknown): string[] {
  if (value === undefined || value === null || value === '') return [];
  const list = Array.isArray(value) ? value : [value];
  return list.flatMap((v) => String(v).split(',')).filter(Boolean);
}

/** Reads a query value as a number, with a default. */
export function asNumber(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && value !== '' && value !== undefined ? n : fallback;
}

/** Slices a list into the paged answer shape. */
export function paginate<T>(all: T[], query: Query): Paged<T> {
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
export function requireOrganizer(e: MockEvent): void {
  if (e.source === 'EXTERNAL') throw new ApiError(403, 'EXTERNAL_EVENT', 'External events cannot be managed here.');
  if (e.organizerId !== MOCK_ME_ID) throw new ApiError(403, 'NOT_ORGANIZER', 'Only the organiser can do this.');
}

/** End of an event: its end time, or 3 hours after the start (reliability rules). */
export function endOf(e: MockEvent): number {
  return e.endsAt ? Date.parse(e.endsAt) : Date.parse(e.startsAt) + 3 * 3_600_000;
}
