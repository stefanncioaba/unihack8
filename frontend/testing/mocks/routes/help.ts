// Mock routes: Neighbour Help Board (docs/API.md → PLAN 25). Same rules and error codes as the Spring API:
// the first scanned helper closes the request (+5 HELPED to them only), other offers become NOT_NEEDED,
// withdrawing and cancelling are free, re-offering keeps the QR token, open requests expire 24 h after posting.
import { ApiError } from '@/api/errors';
import type {
  HelpCategory,
  HelpCheckInResult,
  HelpRequestDetail,
  HelpRequestSummary,
  HelpStatus,
  HelpTicket,
  MyHelpRequests,
  NewHelpRequest,
} from '@/api/types.help';
import { HELP_ADDRESS_MAX, HELP_CATEGORIES, HELP_DESCRIPTION_MAX, HELP_EXPIRY_MS, HELP_POINTS, HELP_TITLE_MAX, HELP_TITLE_MIN } from '@/api/types.help';
import type { ReliabilityEntry } from '@/api/types.users';
import { distanceMeters, isValidCoordinate } from '@/lib/geo';

import { getState, userById, type Route } from '../core';
import { MOCK_ME_ID } from '../data';
import { helpRequestId, type MockHelpRequest } from '../helpSeed';

const BOARD_LIMIT = 50;
const MINE_LIMIT = 20;

/** Finds a request or throws 404. */
function requestById(id: string): MockHelpRequest {
  const found = getState().helpRequests.find((r) => r.id === id);
  if (!found) throw new ApiError(404, 'NOT_FOUND', 'Help request not found');
  return found;
}

/** The status the API reports: an OPEN request past its expiry is EXPIRED. */
export function effectiveStatus(r: MockHelpRequest, now: number = Date.now()): HelpStatus {
  return r.status === 'OPEN' && Date.parse(r.expiresAt) <= now ? 'EXPIRED' : r.status;
}

/** Throws 409 HELP_CLOSED unless the request is still open. */
function requireOpen(r: MockHelpRequest): void {
  if (effectiveStatus(r) !== 'OPEN') throw new ApiError(409, 'HELP_CLOSED', 'This help request is closed.');
}

/** Newest first. */
const newestFirst = (a: MockHelpRequest, b: MockHelpRequest) => Date.parse(b.createdAt) - Date.parse(a.createdAt);

/** Board / list shape, with my offer status. */
function toSummary(r: MockHelpRequest): HelpRequestSummary {
  const mine = r.offers.find((o) => o.userId === MOCK_ME_ID);
  return {
    id: r.id,
    title: r.title,
    category: r.category,
    address: r.address,
    lat: r.lat,
    lon: r.lon,
    requester: { ...userById(r.requesterId) },
    status: effectiveStatus(r),
    createdAt: r.createdAt,
    expiresAt: r.expiresAt,
    offerCount: r.offers.filter((o) => o.status === 'OFFERED' || o.status === 'HELPED').length,
    myOffer: mine ? mine.status : null,
  };
}

/** Detail shape: offers (no withdrawn ones, oldest first), the helper, and what I may do. */
function toDetail(r: MockHelpRequest): HelpRequestDetail {
  const summary = toSummary(r);
  const helped = r.offers.find((o) => o.status === 'HELPED');
  const isRequester = r.requesterId === MOCK_ME_ID;
  const current = summary.myOffer === 'OFFERED' || summary.myOffer === 'HELPED' || summary.myOffer === 'NOT_NEEDED';
  return {
    ...summary,
    description: r.description,
    closedAt: r.closedAt,
    helper: helped ? { ...userById(helped.userId) } : null,
    offers: r.offers
      .filter((o) => o.status !== 'WITHDRAWN')
      .sort((a, b) => Date.parse(a.offeredAt) - Date.parse(b.offeredAt))
      .map((o) => ({ user: { ...userById(o.userId) }, status: o.status, offeredAt: o.offeredAt, skills: [...(getState().skills[o.userId] ?? [])] })),
    isRequester,
    canOffer: summary.status === 'OPEN' && !isRequester && !current,
  };
}

/** Parses `near=lat,lon` or throws 400. */
function parseNear(value: unknown): { lat: number; lon: number } | null {
  if (value === undefined || value === null || value === '') return null;
  const [lat, lon] = String(value).split(',').map(Number);
  if (!isValidCoordinate(lat, lon)) throw new ApiError(400, 'VALIDATION_FAILED', 'Malformed near', { near: 'must be lat,lon' });
  return { lat, lon };
}

/** Parses `bbox=minLon,minLat,maxLon,maxLat` or throws 400. */
function parseBbox(value: unknown): [number, number, number, number] | null {
  if (value === undefined || value === null || value === '') return null;
  const box = String(value).split(',').map(Number);
  if (box.length !== 4 || box.some((n) => !Number.isFinite(n)) || box[0] > box[2] || box[1] > box[3]) {
    throw new ApiError(400, 'VALIDATION_FAILED', 'Malformed bbox', { bbox: 'must be minLon,minLat,maxLon,maxLat' });
  }
  return box as [number, number, number, number];
}

/** Checks a POST body against the API rules; returns the per-field errors. */
function validate(b: Partial<NewHelpRequest>): Record<string, string> {
  const fields: Record<string, string> = {};
  const title = typeof b.title === 'string' ? b.title.trim() : '';
  if (title.length < HELP_TITLE_MIN || title.length > HELP_TITLE_MAX) fields.title = `must be ${HELP_TITLE_MIN}–${HELP_TITLE_MAX} characters`;
  if (typeof b.description === 'string' && b.description.trim().length > HELP_DESCRIPTION_MAX) fields.description = `must be at most ${HELP_DESCRIPTION_MAX} characters`;
  if (typeof b.address === 'string' && b.address.trim().length > HELP_ADDRESS_MAX) fields.address = `must be at most ${HELP_ADDRESS_MAX} characters`;
  if (!b.category || !HELP_CATEGORIES.includes(b.category as HelpCategory)) fields.category = 'is not a valid category';
  const hasLat = b.lat !== undefined && b.lat !== null;
  const hasLon = b.lon !== undefined && b.lon !== null;
  if (hasLat !== hasLon) fields.lat = 'lat and lon go together';
  else if (hasLat && !isValidCoordinate(Number(b.lat), Number(b.lon))) fields.lat = 'is not a valid location';
  return fields;
}

/** Adds a HELPED line (eventId null) to the top of a user's reliability history. */
function logHelped(userId: string): void {
  const entry: ReliabilityEntry = { pointsChange: HELP_POINTS, reason: 'HELPED', eventId: null, eventTitle: null, createdAt: new Date().toISOString() };
  const log = getState().reliabilityLog;
  log[userId] = [entry, ...(log[userId] ?? [])];
}

export const helpRoutes: Route[] = [
  {
    method: 'GET',
    pattern: /^\/help-requests$/,
    handler: ({ query }): HelpRequestSummary[] => {
      const near = parseNear(query.near);
      const box = parseBbox(query.bbox);
      const open = getState()
        .helpRequests.filter((r) => effectiveStatus(r) === 'OPEN')
        // With a bbox, only requests with a location inside it (edges included).
        .filter((r) => !box || (r.lat !== null && r.lon !== null && r.lon >= box[0] && r.lat >= box[1] && r.lon <= box[2] && r.lat <= box[3]))
        .sort(newestFirst);
      if (near) {
        // Closest first; requests without a location last (keeping newest first among them).
        const dist = (r: MockHelpRequest) => (r.lat !== null && r.lon !== null ? distanceMeters(near, { lat: r.lat, lon: r.lon }) : Infinity);
        open.sort((a, b) => dist(a) - dist(b));
      }
      return open.slice(0, BOARD_LIMIT).map(toSummary);
    },
  },
  {
    method: 'GET',
    pattern: /^\/help-requests\/mine$/,
    handler: (): MyHelpRequests => {
      const all = [...getState().helpRequests].sort(newestFirst);
      return {
        requested: all.filter((r) => r.requesterId === MOCK_ME_ID).slice(0, MINE_LIMIT).map(toSummary),
        offered: all
          .filter((r) => r.offers.some((o) => o.userId === MOCK_ME_ID && o.status !== 'WITHDRAWN'))
          .slice(0, MINE_LIMIT)
          .map(toSummary),
      };
    },
  },
  {
    method: 'POST',
    pattern: /^\/help-requests$/,
    handler: ({ body }): HelpRequestDetail => {
      const b = (body ?? {}) as Partial<NewHelpRequest>;
      const fields = validate(b);
      if (Object.keys(fields).length) throw new ApiError(400, 'VALIDATION_FAILED', 'Invalid help request.', fields);
      const now = Date.now();
      const created: MockHelpRequest = {
        id: helpRequestId(100 + getState().helpRequests.length + Math.floor(Math.random() * 1_000_000)),
        title: b.title!.trim(),
        description: b.description?.trim() || null,
        category: b.category as HelpCategory,
        address: b.address?.trim() || null,
        lat: b.lat ?? null,
        lon: b.lon ?? null,
        requesterId: MOCK_ME_ID,
        status: 'OPEN',
        createdAt: new Date(now).toISOString(),
        expiresAt: new Date(now + HELP_EXPIRY_MS).toISOString(),
        closedAt: null,
        offers: [],
      };
      getState().helpRequests.push(created);
      return toDetail(created);
    },
  },
  { method: 'GET', pattern: /^\/help-requests\/([^/]+)$/, handler: ({ params }) => toDetail(requestById(params[0])) },
  {
    method: 'DELETE',
    pattern: /^\/help-requests\/([^/]+)$/,
    handler: ({ params }): HelpRequestDetail => {
      const r = requestById(params[0]);
      if (r.requesterId !== MOCK_ME_ID) throw new ApiError(403, 'NOT_REQUESTER', 'Only the requester can cancel.');
      requireOpen(r);
      r.status = 'CANCELLED';
      r.closedAt = new Date().toISOString();
      return toDetail(r);
    },
  },
  {
    method: 'POST',
    pattern: /^\/help-requests\/([^/]+)\/offers$/,
    handler: ({ params }): HelpTicket => {
      const r = requestById(params[0]);
      if (r.requesterId === MOCK_ME_ID) throw new ApiError(409, 'IS_REQUESTER', 'You cannot offer help on your own request.');
      requireOpen(r);
      const mine = r.offers.find((o) => o.userId === MOCK_ME_ID);
      if (mine && mine.status !== 'WITHDRAWN') throw new ApiError(409, 'ALREADY_OFFERED', 'You already offered.');
      if (mine) {
        // Offering again keeps the same QR token.
        mine.status = 'OFFERED';
        mine.offeredAt = new Date().toISOString();
        return { requestId: r.id, qrToken: mine.qrToken, status: 'OFFERED' };
      }
      const qrToken = `mock-help-ticket-${r.id.slice(-4)}-${Math.random().toString(36).slice(2, 10)}`;
      r.offers.push({ userId: MOCK_ME_ID, status: 'OFFERED', offeredAt: new Date().toISOString(), qrToken });
      return { requestId: r.id, qrToken, status: 'OFFERED' };
    },
  },
  {
    method: 'DELETE',
    pattern: /^\/help-requests\/([^/]+)\/offers\/me$/,
    handler: ({ params }) => {
      const r = requestById(params[0]);
      requireOpen(r);
      const mine = r.offers.find((o) => o.userId === MOCK_ME_ID);
      if (!mine || mine.status !== 'OFFERED') throw new ApiError(409, 'NOT_OFFERED', 'You have no current offer.');
      mine.status = 'WITHDRAWN';
      return { requestId: r.id, status: 'WITHDRAWN' };
    },
  },
  {
    method: 'GET',
    pattern: /^\/help-requests\/([^/]+)\/my-ticket$/,
    handler: ({ params }): HelpTicket => {
      const r = requestById(params[0]);
      const mine = r.offers.find((o) => o.userId === MOCK_ME_ID);
      if (!mine || mine.status === 'WITHDRAWN') throw new ApiError(409, 'NOT_OFFERED', 'You have no current offer.');
      return { requestId: r.id, qrToken: mine.qrToken, status: mine.status };
    },
  },
  {
    method: 'POST',
    pattern: /^\/help-requests\/([^/]+)\/check-in$/,
    handler: ({ params, body }): HelpCheckInResult => {
      const token = String(body?.token ?? '').trim();
      if (!token) throw new ApiError(400, 'VALIDATION_FAILED', 'Invalid check-in.', { token: 'must not be blank' });
      const r = requestById(params[0]);
      if (r.requesterId !== MOCK_ME_ID) throw new ApiError(403, 'NOT_REQUESTER', 'Only the requester can scan helpers.');
      // A closed request (also after the first scan) cannot be scanned again.
      requireOpen(r);
      const owner = getState()
        .helpRequests.flatMap((req) => req.offers.map((o) => ({ req, o })))
        .find((x) => x.o.qrToken === token);
      if (!owner) throw new ApiError(404, 'TICKET_NOT_FOUND', 'This QR code is not a helper code.');
      if (owner.req.id !== r.id) throw new ApiError(409, 'WRONG_REQUEST', 'This code belongs to another help request.');
      if (owner.o.status !== 'OFFERED') throw new ApiError(409, 'NOT_OFFERED', 'This helper withdrew.');

      owner.o.status = 'HELPED';
      for (const other of r.offers) if (other !== owner.o && other.status === 'OFFERED') other.status = 'NOT_NEEDED';
      r.status = 'HELPED';
      r.closedAt = new Date().toISOString();
      const helper = userById(owner.o.userId);
      helper.reliabilityScore += HELP_POINTS;
      logHelped(helper.id);
      return { user: { ...helper }, status: 'HELPED', pointsChange: HELP_POINTS };
    },
  },
];
