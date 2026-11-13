// Profile endpoints (PLAN 16.1-16.3) against the real Spring API: checks the HTTP calls and that the
// backend's JSON shapes (MyEventsResponse, ReliabilityResponse, ProfileResponse) parse as the app expects.
import { changeUsername, getMyEvents, getReliability } from '@/api/endpoints.users';
import { ApiError } from '@/api/errors';
import { supabase } from '@/lib/supabase';

// Real HTTP path: mocks switched off.
jest.mock('@/config', () => ({
  API_URL: 'http://api.test:8080',
  SUPABASE_URL: '',
  SUPABASE_KEY: '',
  USE_MOCKS: false,
}));

/** A minimal fetch Response. */
const respond = (status: number, body: unknown) =>
  ({ status, ok: status >= 200 && status < 300, text: async () => JSON.stringify(body) }) as never;

/** Stubs fetch with one answer and returns the spy. */
const fetchReturns = (status: number, body: unknown) =>
  jest.spyOn(globalThis, 'fetch').mockResolvedValue(respond(status, body));

beforeEach(() => {
  (supabase.auth.getSession as jest.Mock).mockResolvedValue({ data: { session: { access_token: 'tok' } } });
});
afterEach(() => jest.restoreAllMocks());

const summary = {
  id: 'e1',
  source: 'USER',
  title: 'Board games',
  category: 'SOCIAL',
  venueName: 'Cafe',
  lat: 45.75,
  lng: 21.22,
  startsAt: '2026-11-20T18:00:00Z',
  endsAt: null,
  capacity: 10,
  spotsLeft: 4,
};

describe('profile endpoints over HTTP', () => {
  it('GET /users/me/events parses joined and organizing lists', async () => {
    const spy = fetchReturns(200, { joined: [{ event: summary, status: 'JOINED' }], organizing: [summary] });
    const mine = await getMyEvents();
    expect(spy.mock.calls[0][0]).toBe('http://api.test:8080/users/me/events');
    expect((spy.mock.calls[0][1] as RequestInit).headers).toMatchObject({ Authorization: 'Bearer tok' });
    expect(mine.joined[0].status).toBe('JOINED');
    expect(mine.organizing[0].title).toBe('Board games');
  });

  it('GET /users/{id}/reliability parses score and entries', async () => {
    const spy = fetchReturns(200, {
      reliabilityScore: 105,
      entries: [{ pointsChange: 5, reason: 'ATTENDED', eventId: 'e1', eventTitle: 'Board games', createdAt: '2026-11-01T10:00:00Z' }],
    });
    const history = await getReliability('u1');
    expect(spy.mock.calls[0][0]).toBe('http://api.test:8080/users/u1/reliability');
    expect(history.reliabilityScore).toBe(105);
    expect(history.entries[0].reason).toBe('ATTENDED');
  });

  it('PATCH /users/me sends the new username', async () => {
    const spy = fetchReturns(200, { id: 'u1', username: 'new_name', reliabilityScore: 100 });
    const me = await changeUsername('new_name');
    const init = spy.mock.calls[0][1] as RequestInit;
    expect(spy.mock.calls[0][0]).toBe('http://api.test:8080/users/me');
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(init.body as string)).toEqual({ username: 'new_name' });
    expect(me.username).toBe('new_name');
  });

  it('maps 409 USERNAME_TAKEN to an ApiError', async () => {
    fetchReturns(409, { code: 'USERNAME_TAKEN', message: 'This username is already taken.' });
    await expect(changeUsername('taken')).rejects.toMatchObject({ status: 409, code: 'USERNAME_TAKEN' });
    await expect(changeUsername('taken')).rejects.toBeInstanceOf(ApiError);
  });
});
