// Mock routes: events. Shapes follow docs/API.md.
import { ApiError } from '@/api/errors';
import type { CheckInResult, EventCategory, EventDetail, EventSummary, NewEvent, Paged, Participant } from '@/api/types';
import { EVENT_CATEGORIES } from '@/api/types';

import { asList, endOf, eventById, getState, me, paginate, requireOrganizer, taken, toDetail, toSummary, userById, type Route } from '../core';
import { MOCK_ME_ID, type MockEvent } from '../data';

export const eventsRoutes: Route[] = [
  {
    method: 'GET',
    pattern: /^\/events$/,
    handler: ({ query }): Paged<EventSummary> => {
      const q = String(query.q ?? '').trim().toLowerCase();
      const categories = asList(query.category);
      const from = query.from ? Date.parse(String(query.from)) : Date.now();
      const to = query.to ? Date.parse(String(query.to)) : Infinity;
      const source = query.source ? String(query.source) : null;
      const box = query.bbox ? String(query.bbox).split(',').map(Number) : null;
      if (box && (box.length !== 4 || box.some((n) => !Number.isFinite(n)))) {
        throw new ApiError(400, 'VALIDATION_FAILED', 'Malformed bbox', { bbox: 'is malformed' });
      }
      const list = getState().events
        .filter((e) => Date.parse(e.startsAt) >= from && Date.parse(e.startsAt) < to)
        .filter((e) => !q || e.title.toLowerCase().includes(q))
        .filter((e) => categories.length === 0 || categories.includes(e.category))
        .filter((e) => !source || e.source === source)
        // With a bbox, events without coordinates are left out (docs/API.md).
        .filter((e) => !box || (e.lat !== null && e.lon !== null && e.lon >= box[0] && e.lat >= box[1] && e.lon <= box[2] && e.lat <= box[3]))
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
      getState().events.push(created);
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
      const owner = getState().events.flatMap((ev) => ev.participants.map((p) => ({ ev, p }))).find((x) => x.p.qrToken === token);
      if (!owner) throw new ApiError(404, 'TICKET_NOT_FOUND', 'This QR code is not a ticket.');
      if (owner.ev.id !== e.id) throw new ApiError(409, 'WRONG_EVENT', 'Ticket belongs to another event.');
      if (owner.p.status === 'BANNED') throw new ApiError(403, 'BANNED', 'This participant is banned.');
      if (owner.p.status === 'ATTENDED') throw new ApiError(409, 'ALREADY_CHECKED_IN', 'Already scanned.');
      if (endOf(e) < Date.now()) throw new ApiError(409, 'EVENT_ENDED', 'This event is over.');
      owner.p.status = 'ATTENDED';
      const user = userById(owner.p.userId);
      user.reliabilityScore += 5;
      getState().attended[user.id] = [e.id, ...(getState().attended[user.id] ?? [])];
      return { user: { ...user }, status: 'ATTENDED', pointsChange: 5 };
    },
  },
];
