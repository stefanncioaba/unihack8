// Typed wrappers around the Neighbour Help Board endpoints (docs/API.md → PLAN task 25). All need a token.
import { api } from './client';
import type {
  HelpCheckInResult,
  HelpRequestDetail,
  HelpRequestSummary,
  HelpTicket,
  HelpWithdrawResult,
  MyHelpRequests,
  NewHelpRequest,
} from './types.help';

/** Optional board filters: `near=lat,lon` sorts by distance; `bbox=minLon,minLat,maxLon,maxLat` keeps located requests inside the box. */
export type HelpBoardQuery = { near?: string; bbox?: string };

/** The board: open requests, newest first, or closest first with `near`; only those inside `bbox` when given. */
export const listHelpRequests = (query: HelpBoardQuery = {}, signal?: AbortSignal) =>
  api<HelpRequestSummary[]>('GET', '/help-requests', { query, signal });

/** My own requests and the requests I offered on (every status). */
export const getMyHelpRequests = () => api<MyHelpRequests>('GET', '/help-requests/mine');

/** Posts a new request; answers with its details. */
export const createHelpRequest = (body: NewHelpRequest) => api<HelpRequestDetail>('POST', '/help-requests', { body });

/** One request with its offers (closed and expired ones stay readable). */
export const getHelpRequest = (id: string) => api<HelpRequestDetail>('GET', `/help-requests/${id}`);

/** Requester only: cancels an open request (free). */
export const cancelHelpRequest = (id: string) => api<HelpRequestDetail>('DELETE', `/help-requests/${id}`);

/** Offer to help; answers with my QR token (the same one again after a withdrawal). */
export const offerHelp = (id: string) => api<HelpTicket>('POST', `/help-requests/${id}/offers`);

/** Withdraw my offer (free). */
export const withdrawHelp = (id: string) => api<HelpWithdrawResult>('DELETE', `/help-requests/${id}/offers/me`);

/** My helper QR code for a request I offered on. */
export const getHelpTicket = (id: string) => api<HelpTicket>('GET', `/help-requests/${id}/my-ticket`);

/** Requester only: scans a helper's QR code; the first scan closes the request. */
export const helpCheckIn = (id: string, token: string) =>
  api<HelpCheckInResult>('POST', `/help-requests/${id}/check-in`, { body: { token } });
