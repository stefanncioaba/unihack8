// Typed wrappers around every endpoint the app uses (docs/API.md). Screens call these through hooks.
import { api } from './client';
import type {
  BanResult,
  CheckInResult,
  EventDetail,
  EventReviews,
  EventQuery,
  EventSummary,
  JoinResult,
  LeaveResult,
  Me,
  NewEvent,
  Paged,
  Participant,
  PublicProfile,
  Review,
  ReviewInput,
  Ticket,
  UsernameAvailability,
  UserSummary,
} from './types';

// ---- Users -------------------------------------------------------------

/** Public: is this username free? Used by the sign-up form. */
export const checkUsername = (username: string) =>
  api<UsernameAvailability>('GET', '/users/username-available', { query: { username } });

/** The signed-in user's own profile. */
export const getMe = () => api<Me>('GET', '/users/me');

/** Username prefix search (max 20 results). */
export const searchUsers = (q: string, signal?: AbortSignal) =>
  api<UserSummary[]>('GET', '/users/search', { query: { q }, signal });

/** Public profile of any user. */
export const getUser = (id: string) => api<PublicProfile>('GET', `/users/${id}`);

// ---- Events ------------------------------------------------------------

/** Paged event list with the filters of the "All events" screen. */
export const listEvents = (query: EventQuery, signal?: AbortSignal) =>
  api<Paged<EventSummary>>('GET', '/events', { query: query as Record<string, never>, signal });

/** Full details of one event, including my participation status. */
export const getEvent = (id: string) => api<EventDetail>('GET', `/events/${id}`);

/** Creates a user event; answers with the new event's details. */
export const createEvent = (body: NewEvent) => api<EventDetail>('POST', '/events', { body });

/** Join an event; answers with my QR token. */
export const joinEvent = (id: string) => api<JoinResult>('POST', `/events/${id}/join`);

/** Leave an event (a late leave costs reliability points). */
export const leaveEvent = (id: string) => api<LeaveResult>('DELETE', `/events/${id}/join`);

/** Everyone who joined, with their reliability score. */
export const getParticipants = (id: string) => api<Participant[]>('GET', `/events/${id}/participants`);

/** Organiser only: ban a participant and free the spot. */
export const banParticipant = (eventId: string, userId: string) =>
  api<BanResult>('POST', `/events/${eventId}/participants/${userId}/ban`);

/** My ticket (the QR token) for an event I joined. */
export const getMyTicket = (id: string) => api<Ticket>('GET', `/events/${id}/my-ticket`);

/** Organiser only: check a scanned ticket in. */
export const checkIn = (eventId: string, token: string) =>
  api<CheckInResult>('POST', `/events/${eventId}/check-in`, { body: { token } });

/** Public: average rating, every review and whether I may review (token optional). */
export const getEventReviews = (id: string) => api<EventReviews>('GET', `/events/${id}/reviews`);

/** Checked-in attendee only: creates or replaces my review (403 NOT_ATTENDED, 409 REVIEWS_CLOSED / IS_ORGANIZER). */
export const saveMyReview = (id: string, body: ReviewInput) => api<Review>('PUT', `/events/${id}/reviews/me`, { body });
