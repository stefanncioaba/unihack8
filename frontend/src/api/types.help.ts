// Response and request shapes of the Neighbour Help Board (docs/API.md → "Neighbour Help Board — PLAN task 25").
import type { UserSummary } from './types';

/** What kind of help is needed. */
export type HelpCategory = 'BORROW' | 'CARRY' | 'PETS' | 'ERRANDS' | 'REPAIRS' | 'OTHER';

export const HELP_CATEGORIES: HelpCategory[] = ['BORROW', 'CARRY', 'PETS', 'ERRANDS', 'REPAIRS', 'OTHER'];

/** OPEN until a helper is scanned (HELPED), the requester cancels, or 24 h pass (EXPIRED). */
export type HelpStatus = 'OPEN' | 'HELPED' | 'CANCELLED' | 'EXPIRED';

/** One helper's offer: HELPED = was scanned, NOT_NEEDED = someone else was scanned first. */
export type HelpOfferStatus = 'OFFERED' | 'WITHDRAWN' | 'HELPED' | 'NOT_NEEDED';

/** A request on the board (and in "mine"). `myOffer` is the caller's offer status, or null. */
export type HelpRequestSummary = {
  id: string;
  title: string;
  category: HelpCategory;
  address: string | null;
  lat: number | null;
  lon: number | null;
  requester: UserSummary;
  status: HelpStatus;
  createdAt: string;
  expiresAt: string;
  /** Current offers (OFFERED and HELPED). */
  offerCount: number;
  myOffer: HelpOfferStatus | null;
};

/** One person who offered to help (withdrawn offers are left out). */
export type HelpOffer = { user: UserSummary; status: HelpOfferStatus; offeredAt: string };

/** Full request: the summary plus description, offers and what the caller may do. */
export type HelpRequestDetail = HelpRequestSummary & {
  description: string | null;
  closedAt: string | null;
  /** The scanned helper once HELPED. */
  helper: UserSummary | null;
  offers: HelpOffer[];
  isRequester: boolean;
  canOffer: boolean;
};

/** GET /help-requests/mine: my own requests and the ones I offered on. */
export type MyHelpRequests = { requested: HelpRequestSummary[]; offered: HelpRequestSummary[] };

/** Body of POST /help-requests (lat / lon both or neither). */
export type NewHelpRequest = {
  title: string;
  description?: string;
  category: HelpCategory;
  address?: string;
  lat?: number;
  lon?: number;
};

/** Answer of offering help, and of reading my ticket. The QR code holds only `qrToken`. */
export type HelpTicket = { requestId: string; qrToken: string; status: HelpOfferStatus };

/** Answer of withdrawing an offer. */
export type HelpWithdrawResult = { requestId: string; status: 'WITHDRAWN' };

/** Answer of the requester scanning a helper's QR code. */
export type HelpCheckInResult = { user: UserSummary; status: 'HELPED'; pointsChange: number };

/** Limits of the create form (same as the API). */
export const HELP_TITLE_MIN = 3;
export const HELP_TITLE_MAX = 80;
export const HELP_DESCRIPTION_MAX = 500;
export const HELP_ADDRESS_MAX = 120;

/** Civic trust points the scanned helper gets. */
export const HELP_POINTS = 5;

/** An open request disappears this long after it was posted. */
export const HELP_EXPIRY_MS = 24 * 3_600_000;
