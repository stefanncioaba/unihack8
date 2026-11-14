// AI assistant shapes. Source of truth: docs/API.md -> AI assistant.
import type { EventSummary } from './types';
import type { PlaceSummary } from './types.places';
import type { PlanMode } from './types.routing';

export type ChatRole = 'user' | 'assistant';

/** One message as the backend wants it: the app sends the whole conversation every time. */
export type ChatMessage = { role: ChatRole; content: string };

export type ChatRequest = {
  /** At most 20 messages; the app drops the oldest first. */
  messages: ChatMessage[];
  /** Null when location permission was denied. */
  location: { lat: number; lon: number } | null;
};

/** A web page the assistant used for prices, menus or reviews. */
export type ChatSource = { title: string; url: string };

/** One end of a route the assistant planned; `name` is "Your location", a place/event name, or null. */
export type ChatRoutePoint = { lat: number; lon: number; name: string | null };

/** A route the assistant planned for its answer (PLAN 18.1). "Go" is offered only when `startsFromUser`. */
export type ChatRoute = {
  from: ChatRoutePoint;
  to: ChatRoutePoint;
  mode: PlanMode;
  durationMinutes: number;
  distanceMeters: number;
  startsFromUser: boolean;
};

export type ChatAnswer = {
  reply: string;
  /** Places and events mentioned in `reply`, for result cards and "show on map". */
  places: PlaceSummary[];
  events: EventSummary[];
  sources: ChatSource[];
  /** Routes planned for the answer, for route cards (empty, never null). */
  routes: ChatRoute[];
};

/** The backend accepts at most this many messages per request. */
export const MAX_CHAT_MESSAGES = 20;

/** Longest message the API accepts (backend ChatMessageDto @Size(max = 2000)). */
export const MAX_CHAT_MESSAGE_CHARS = 2000;
