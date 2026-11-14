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

/** Where the time of the vehicle to catch comes from: a tracked vehicle, STPT's timetable, or the route planner. */
export type LeaveNowSource = 'LIVE' | 'TIMETABLE' | 'PLAN';

/** "Leave now": when to leave so the walk ends at the first stop in time for the first tram/bus (PLAN 24). */
export type ChatLeaveNow = {
  line: string;
  /** TRAM, TROLLEYBUS or BUS. */
  vehicleType: string;
  headsign: string | null;
  stopName: string | null;
  walkMinutes: number;
  /** When the vehicle the user can catch reaches the stop (ISO, UTC). */
  boardAt: string;
  /** When to start walking: boardAt minus the walk and one spare minute (ISO, UTC). */
  leaveAt: string;
  source: LeaveNowSource;
  /** An earlier vehicle of the same line the user can no longer reach; null when none. */
  missedBoardAt: string | null;
};

/** A route the assistant planned for its answer (PLAN 18.1). "Go" is offered only when `startsFromUser`. */
export type ChatRoute = {
  from: ChatRoutePoint;
  to: ChatRoutePoint;
  mode: PlanMode;
  durationMinutes: number;
  distanceMeters: number;
  startsFromUser: boolean;
  /** Null for walking routes, routes that do not start at the user, and routes planned for a later time. */
  leaveNow: ChatLeaveNow | null;
};

/** One priced line of the cost box: a recommended place (stored menu prices) or event (ticket price range). */
export type ChatCostItem = {
  label: string;
  /** What the price is for: the item ("Espresso"), "N stored prices", or "Ticket". */
  detail: string;
  /** TICKET is reserved for stored STPT fares (PLAN 20) and not sent yet. */
  kind: 'MENU' | 'EVENT' | 'TICKET';
  minLei: number;
  maxLei: number;
  /** (minLei + maxLei) / 2. */
  averageLei: number;
};

/**
 * Average cost of what the answer recommends, from stored prices only (never the model's text).
 * TOTAL: one plan, totals are sums. OPTIONS: alternatives, the average is across the options.
 */
export type ChatCost = {
  currency: 'RON';
  basis: 'TOTAL' | 'OPTIONS';
  items: ChatCostItem[];
  averageTotalLei: number;
  minTotalLei: number;
  maxTotalLei: number;
  note: string;
};

export type ChatAnswer = {
  reply: string;
  /** Places and events mentioned in `reply`, for result cards and "show on map". */
  places: PlaceSummary[];
  events: EventSummary[];
  sources: ChatSource[];
  /** Routes planned for the answer, for route cards (empty, never null). */
  routes: ChatRoute[];
  /** The cost box; null when nothing recommended has a stored price. Optional for older backends. */
  cost?: ChatCost | null;
};

/** The backend accepts at most this many messages per request. */
export const MAX_CHAT_MESSAGES = 20;

/** Longest message the API accepts (backend ChatMessageDto @Size(max = 2000)). */
export const MAX_CHAT_MESSAGE_CHARS = 2000;
