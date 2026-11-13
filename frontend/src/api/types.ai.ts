// AI assistant shapes. Source of truth: docs/API.md -> AI assistant.
import type { EventSummary } from './types';
import type { PlaceSummary } from './types.places';

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

export type ChatAnswer = {
  reply: string;
  /** Places and events mentioned in `reply`, for result cards and "show on map". */
  places: PlaceSummary[];
  events: EventSummary[];
  sources: ChatSource[];
};

/** The backend accepts at most this many messages per request. */
export const MAX_CHAT_MESSAGES = 20;
