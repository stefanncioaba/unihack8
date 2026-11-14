// Mock routes: AI assistant (docs/API.md -> AI assistant). Backend task 11 is not built yet, so answers are canned
// from keywords in the last user message. Special words trigger the documented errors:
// "ratelimit" -> 429 RATE_LIMITED, "unavailable" -> 503 AI_UNAVAILABLE.
import { ApiError } from '@/api/errors';
import type { EventSummary } from '@/api/types';
import type { ChatAnswer, ChatCost, ChatCostItem, ChatRequest, ChatRoute } from '@/api/types.ai';
import type { PlaceDetail, PlaceSummary } from '@/api/types.places';

import { getState, toSummary, type Route } from '../core';
import { seedPlaces } from '../placesSeed';

const PLACES = seedPlaces();

/** Straight-line distance in metres (small-distance approximation, good enough for mock answers). */
function metersBetween(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const dLat = (bLat - aLat) * 111_320;
  const dLon = (bLon - aLon) * 111_320 * Math.cos((aLat * Math.PI) / 180);
  return Math.round(Math.hypot(dLat, dLon));
}

/** Place summary with a distance when the user's location is known. */
function placeSummary(p: PlaceDetail, location: ChatRequest['location']): PlaceSummary {
  return {
    id: p.id,
    osmId: p.osmId,
    name: p.name,
    category: p.category,
    lat: p.lat,
    lon: p.lon,
    address: p.address,
    distanceMeters: location ? metersBetween(location.lat, location.lon, p.lat, p.lon) : null,
  };
}

/** The closest `count` places of a category. */
function closest(category: PlaceDetail['category'], count: number, location: ChatRequest['location']): PlaceSummary[] {
  return PLACES.filter((p) => p.category === category)
    .map((p) => placeSummary(p, location))
    .sort((a, b) => (a.distanceMeters ?? 0) - (b.distanceMeters ?? 0))
    .slice(0, count);
}

/** The next upcoming events. */
function upcomingEvents(count: number): EventSummary[] {
  return getState()
    .events.filter((e) => Date.parse(e.startsAt) > Date.now())
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt))
    .slice(0, count)
    .map(toSummary);
}

/** The University of the West, the start of "from the university" routes. */
const UNIVERSITY = { lat: 45.7472, lon: 21.231, name: 'West University' };

/** A route card for a place: from the user (when the location is known) or from the university. */
function routeTo(place: PlaceSummary, request: ChatRequest, fromUniversity: boolean): ChatRoute {
  const cityCentre = { lat: 45.7537, lon: 21.2257, name: null };
  const user = request.location ? { ...request.location, name: 'Your location' } : cityCentre;
  const start = fromUniversity ? UNIVERSITY : user;
  const meters = metersBetween(start.lat, start.lon, place.lat, place.lon);
  return {
    from: start,
    to: { lat: place.lat, lon: place.lon, name: place.name },
    mode: 'WALK',
    durationMinutes: Math.max(1, Math.round((meters * 1.3) / 80)),
    distanceMeters: Math.round(meters * 1.3),
    // As the backend decides it (PLAN 18.3): only from the user's real position.
    startsFromUser: !fromUniversity && request.location !== null,
    leaveNow: null,
  };
}

/** A tram trip to a place with its "Leave now" box (PLAN 26): 4 min walk, tram 1 in 11 min, leave in 6 min. */
function tramTo(place: PlaceSummary, request: ChatRequest): ChatRoute {
  const walk = routeTo(place, request, false);
  const now = Date.now();
  const boardAt = now + 11 * 60_000;
  return {
    ...walk,
    mode: 'TRANSIT',
    durationMinutes: 20,
    leaveNow: walk.startsFromUser
      ? {
          line: '1',
          vehicleType: 'TRAM',
          headsign: 'Gara de Nord',
          stopName: 'Piața Libertății',
          walkMinutes: 4,
          boardAt: new Date(boardAt).toISOString(),
          leaveAt: new Date(boardAt - 5 * 60_000).toISOString(),
          source: 'LIVE',
          missedBoardAt: new Date(now + 3 * 60_000).toISOString(),
        }
      : null,
  };
}

/** Rounded to 0.1 lei, like the backend. */
const round1 = (lei: number) => Math.round(lei * 10) / 10;

/** A priced cost line; the average is (min + max) / 2 as the backend computes it. */
function costItem(label: string, detail: string, kind: ChatCostItem['kind'], minLei: number, maxLei: number): ChatCostItem {
  return { label, detail, kind, minLei, maxLei, averageLei: round1((minLei + maxLei) / 2) };
}

/**
 * The cost box with the backend's rule (docs/API.md -> AI assistant, `cost`): lines are grouped by kind; within a kind
 * the user picks one (mean of the line averages, cheapest min, dearest max) and the kinds are added up. `options` sets
 * the basis (OPTIONS when the answer offers alternatives). Null when no line has a price.
 */
export function mockCost(items: ChatCostItem[], options: boolean, note = 'Saved menu prices (often from delivery apps); they may have changed.'): ChatCost | null {
  if (items.length === 0) return null;
  const groups = new Map<ChatCostItem['kind'], ChatCostItem[]>();
  for (const item of items) groups.set(item.kind, [...(groups.get(item.kind) ?? []), item]);
  let average = 0;
  let min = 0;
  let max = 0;
  for (const group of groups.values()) {
    average += group.reduce((a, i) => a + i.averageLei, 0) / group.length;
    min += Math.min(...group.map((i) => i.minLei));
    max += Math.max(...group.map((i) => i.maxLei));
  }
  return {
    currency: 'RON',
    basis: options ? 'OPTIONS' : 'TOTAL',
    items,
    averageTotalLei: round1(average),
    minTotalLei: round1(min),
    maxTotalLei: round1(max),
    note,
  };
}

/** Canned stored menu prices for the mock pizza answer (the seed places carry no prices). */
const MOCK_MAINS: [number, number][] = [
  [30, 45],
  [28, 40],
  [32, 48],
];

/** Builds a canned answer from the last user message. */
function answer(request: ChatRequest): ChatAnswer {
  const last = [...request.messages].reverse().find((m) => m.role === 'user')?.content.toLowerCase() ?? '';
  if (last.includes('ratelimit')) throw new ApiError(429, 'RATE_LIMITED', 'Too many AI requests. Try again in a minute.');
  if (last.includes('unavailable')) throw new ApiError(503, 'AI_UNAVAILABLE', 'The assistant did not answer.');

  if (/by tram|by bus|public transport/.test(last)) {
    const places = closest('cafe', 1, request.location);
    const route = tramTo(places[0], request);
    const leave = route.leaveNow;
    return {
      reply: leave
        ? `Leave in 6 min to catch tram 1 at ${leave.stopName}. ${places[0].name} is about 20 min away.`
        : `${places[0].name} is about 20 min away by tram.`,
      places,
      events: [],
      sources: [],
      routes: [route],
    };
  }
  if (/how do i get|directions|get to|route/.test(last)) {
    const fromUniversity = /university|universitate/.test(last);
    const places = closest('cafe', 1, request.location);
    const route = routeTo(places[0], request, fromUniversity);
    return {
      reply: `${places[0].name} is about ${route.durationMinutes} min on foot${fromUniversity ? ' from the university' : ''}. An espresso there is about 7 lei.`,
      places,
      events: [],
      sources: [],
      routes: [route],
      cost: mockCost([costItem(places[0].name, 'Espresso', 'MENU', 7, 7)], false),
    };
  }
  if (/pizza|eat|food|restaurant|hungry/.test(last)) {
    const places = closest('restaurant', 3, request.location);
    return {
      reply: `For a good, affordable meal I would start with ${places[0].name}${places[0].distanceMeters !== null ? ` (${places[0].distanceMeters} m away)` : ''}. Reviews mention friendly service and mains around 30–45 lei. ${places[1].name} and ${places[2].name} are solid alternatives nearby.`,
      places,
      events: [],
      sources: [{ title: `${places[0].name} – menu and reviews`, url: 'https://example.ro/meniu' }],
      routes: [],
      cost: mockCost(
        places.map((p, i) => costItem(p.name, '3 stored prices', 'MENU', ...MOCK_MAINS[i % MOCK_MAINS.length])),
        places.length > 1,
      ),
    };
  }
  if (/coffee|cafe|café/.test(last)) {
    const places = closest('cafe', 3, request.location);
    return { reply: `Here are the cafés closest to you. ${places[0].name} is the nearest and has outdoor seating.`, places, events: [], sources: [], routes: [], cost: null };
  }
  if (/weekend|event|party|go out|tonight|do /.test(last)) {
    const events = upcomingEvents(3);
    return {
      reply: `Coming up in Timișoara: ${events.map((e) => e.title).join(', ')}. Tap a card to see the details or find it on the map.`,
      places: [],
      events,
      sources: [],
      routes: [],
      cost: mockCost(
        events
          .filter((e) => e.priceMin !== null || e.priceMax !== null)
          .map((e) => costItem(e.title, 'Ticket', 'EVENT', e.priceMin ?? e.priceMax ?? 0, e.priceMax ?? e.priceMin ?? 0)),
        events.length > 1,
        'Saved ticket prices; they may have changed.',
      ),
    };
  }
  return {
    reply: 'I can help you find places to eat or drink, events happening this week, and how to get there. What are you in the mood for?',
    places: [],
    events: [],
    sources: [],
    routes: [],
    cost: null,
  };
}

export const aiRoutes: Route[] = [
  {
    method: 'POST',
    pattern: /^\/ai\/chat$/,
    handler: ({ body }): ChatAnswer => {
      const request = (body ?? {}) as Partial<ChatRequest>;
      if (!Array.isArray(request.messages) || request.messages.length === 0 || request.messages.length > 20) {
        throw new ApiError(400, 'VALIDATION_FAILED', 'Send between 1 and 20 messages.', { messages: 'must contain 1 to 20 items' });
      }
      return answer({ messages: request.messages, location: request.location ?? null });
    },
  },
];
