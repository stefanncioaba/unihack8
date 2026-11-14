// Mock routes: AI assistant (docs/API.md -> AI assistant). Backend task 11 is not built yet, so answers are canned
// from keywords in the last user message. Special words trigger the documented errors:
// "ratelimit" -> 429 RATE_LIMITED, "unavailable" -> 503 AI_UNAVAILABLE.
import { ApiError } from '@/api/errors';
import type { EventSummary } from '@/api/types';
import type { ChatAnswer, ChatRequest, ChatRoute } from '@/api/types.ai';
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
  };
}

/** Builds a canned answer from the last user message. */
function answer(request: ChatRequest): ChatAnswer {
  const last = [...request.messages].reverse().find((m) => m.role === 'user')?.content.toLowerCase() ?? '';
  if (last.includes('ratelimit')) throw new ApiError(429, 'RATE_LIMITED', 'Too many AI requests. Try again in a minute.');
  if (last.includes('unavailable')) throw new ApiError(503, 'AI_UNAVAILABLE', 'The assistant did not answer.');

  if (/how do i get|directions|get to|route/.test(last)) {
    const fromUniversity = /university|universitate/.test(last);
    const places = closest('cafe', 1, request.location);
    const route = routeTo(places[0], request, fromUniversity);
    return {
      reply: `${places[0].name} is about ${route.durationMinutes} min on foot${fromUniversity ? ' from the university' : ''}.`,
      places,
      events: [],
      sources: [],
      routes: [route],
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
    };
  }
  if (/coffee|cafe|café/.test(last)) {
    const places = closest('cafe', 3, request.location);
    return { reply: `Here are the cafés closest to you. ${places[0].name} is the nearest and has outdoor seating.`, places, events: [], sources: [], routes: [] };
  }
  if (/weekend|event|party|go out|tonight|do /.test(last)) {
    const events = upcomingEvents(3);
    return {
      reply: `Coming up in Timișoara: ${events.map((e) => e.title).join(', ')}. Tap a card to see the details or find it on the map.`,
      places: [],
      events,
      sources: [],
      routes: [],
    };
  }
  return {
    reply: 'I can help you find places to eat or drink, events happening this week, and how to get there. What are you in the mood for?',
    places: [],
    events: [],
    sources: [],
    routes: [],
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
