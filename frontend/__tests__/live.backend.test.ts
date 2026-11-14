// Live check (PLAN 17.1): the app's own endpoint functions and API client against a RUNNING Spring backend,
// with no mock data. Skipped in normal runs. Run it with the backend started (see DOCS.md):
//   LIVE_API_URL=http://localhost:8080 LIVE_TOKEN=<Supabase access token> npx jest live.backend
// Without LIVE_TOKEN only the public endpoints run.
const LIVE_URL = process.env.LIVE_API_URL;
const LIVE_TOKEN = process.env.LIVE_TOKEN;
const describeLive = LIVE_URL ? describe : describe.skip;
const itAuth = LIVE_TOKEN ? it : it.skip;

jest.unmock('@/api/client');
jest.mock('@/config', () => ({ API_URL: process.env.LIVE_API_URL ?? '', SUPABASE_URL: '', SUPABASE_KEY: '' }));

import { sendChat } from '@/api/endpoints.ai';
import { getPlace, listPlaces } from '@/api/endpoints.places';
import { planRoute } from '@/api/endpoints.routing';
import {
  getLastDepartures,
  getStopArrivals,
  getTransitAlerts,
  getTransitRoutes,
  getTransitStops,
  getTransitSummary,
  getTransitVehicles,
} from '@/api/endpoints.transit';
import { checkUsername, getEvent, getParticipants, listEvents, searchUsers } from '@/api/endpoints';
import { decodePolyline } from '@/lib/polyline';
import { formatEventDate, formatTime } from '@/lib/time';
import { supabase } from '@/lib/supabase';

const CENTRE = '45.75370,21.22570';
const GARA = '45.75050,21.20750';

/** Every key the app reads must be present (null is allowed, missing is not). */
function expectKeys(value: object, keys: string[]) {
  for (const key of keys) expect(Object.prototype.hasOwnProperty.call(value, key)).toBe(true);
}

describeLive('live backend (no mocks)', () => {
  jest.setTimeout(120_000);

  beforeAll(() => {
    (supabase.auth.getSession as jest.Mock).mockResolvedValue({
      data: { session: LIVE_TOKEN ? { access_token: LIVE_TOKEN } : null },
    });
  });

  it('places: list near the centre and one detail', async () => {
    const page = await listPlaces({ near: CENTRE, radius: 800, category: ['cafe'], size: 5 });
    expectKeys(page, ['items', 'page', 'size', 'totalItems', 'totalPages']);
    expect(page.items.length).toBeGreaterThan(0);
    expectKeys(page.items[0], ['id', 'osmId', 'name', 'category', 'lat', 'lon', 'address', 'distanceMeters']);
    const detail = await getPlace(page.items[0].id);
    expectKeys(detail, ['openingHours', 'tags']);
  });

  it('events: list, detail and participants, with dates the app can format', async () => {
    const page = await listEvents({ size: 5 });
    expect(page.items.length).toBeGreaterThan(0);
    const first = page.items[0];
    expectKeys(first, ['id', 'source', 'title', 'category', 'venueName', 'lat', 'lon', 'startsAt', 'endsAt', 'imageUrl', 'priceMin', 'priceMax', 'capacity', 'spotsLeft']);
    expect(formatEventDate(first.startsAt)).not.toMatch(/NaN/);
    const detail = await getEvent(first.id);
    expectKeys(detail, ['description', 'participantCount', 'organizer', 'myStatus', 'externalUrl']);
    expect(Array.isArray(await getParticipants(first.id))).toBe(true);
    const other = await listEvents({ category: ['OTHER'], size: 5 });
    expect(other.items.every((e) => e.category === 'OTHER')).toBe(true);
  });

  it('transit: summary in English, routes, stops, vehicles, arrivals, last departures, alerts', async () => {
    const summary = await getTransitSummary(CENTRE);
    expectKeys(summary, ['nearestStop', 'nextArrival', 'lastDepartures', 'activeAlerts', 'message']);
    expect(summary.message).toMatch(/Next|Last|No more|No departures/); // English, not Romanian
    expect((await getTransitRoutes()).length).toBeGreaterThan(0);
    const stops = await getTransitStops('21.22,45.75,21.23,45.76');
    expect(stops.length).toBeGreaterThan(0);
    expectKeys(stops[0], ['id', 'name', 'lat', 'lon', 'routes']);
    expectKeys(await getTransitVehicles('1'), ['route', 'updatedAt', 'stale', 'vehicles']);
    expectKeys(await getStopArrivals(stops[0].id), ['stopId', 'stopName', 'arrivals', 'stale']);
    expectKeys(await getLastDepartures(stops[0].id), ['stopId', 'source', 'departures']);
    expect(Array.isArray(await getTransitAlerts())).toBe(true);
  });

  it('users: username availability (public, used before sign-in)', async () => {
    expectKeys(await checkUsername('someone_brand_new_42'), ['username', 'available']);
  });

  itAuth('routes: walking and transit plans render without crashing', async () => {
    for (const mode of ['WALK', 'TRANSIT'] as const) {
      const plan = await planRoute(CENTRE, GARA, mode);
      expectKeys(plan, ['mode', 'durationMinutes', 'distanceMeters', 'startsAt', 'endsAt', 'fallback', 'legs']);
      for (const leg of plan.legs) {
        expect(Array.isArray(decodePolyline(leg.polyline))).toBe(true);
        if (leg.startsAt) expect(formatTime(leg.startsAt)).toMatch(/^\d\d:\d\d$/);
      }
    }
  });

  itAuth('users: search', async () => {
    expect(Array.isArray(await searchUsers('a'))).toBe(true);
  });

  itAuth('AI: real assistant answer with place cards', async () => {
    const answer = await sendChat({
      messages: [{ role: 'user', content: 'Where can I drink cheap coffee near me and how much does it cost?' }],
      location: { lat: 45.7537, lon: 21.2257 },
    });
    expectKeys(answer, ['reply', 'places', 'events', 'sources']);
    expect(answer.reply.length).toBeGreaterThan(0);
  });
});
