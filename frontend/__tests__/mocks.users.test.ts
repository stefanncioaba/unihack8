// Mock backend for the profile endpoints (docs/API.md → Users): change username, my events, reliability history.
import { ApiError } from '@/api/errors';
import { getMockState, mockRequest } from '@test/mocks';

import { IDS } from './testUtils';

const call = (method: string, path: string, query: Record<string, unknown> = {}, body?: unknown) => mockRequest(method, path, query, body) as Promise<any>;
const ME = '11111111-1111-4111-8111-111111111111';

describe('mock backend: PATCH /users/me', () => {
  it('changes my username and returns the updated profile', async () => {
    const updated = await call('PATCH', '/users/me', {}, { username: 'new_name_1' });
    expect(updated).toMatchObject({ id: ME, username: 'new_name_1', reliabilityScore: 100 });
    expect((await call('GET', '/users/me')).username).toBe('new_name_1');
  });

  it('rejects a badly formed username with INVALID_USERNAME', async () => {
    await expect(call('PATCH', '/users/me', {}, { username: 'a!' })).rejects.toMatchObject({ status: 400, code: 'INVALID_USERNAME' });
    await expect(call('PATCH', '/users/me', {}, {})).rejects.toBeInstanceOf(ApiError);
  });

  it('rejects a name someone else has, ignoring case, with USERNAME_TAKEN', async () => {
    await expect(call('PATCH', '/users/me', {}, { username: 'STEFAN' })).rejects.toMatchObject({ status: 409, code: 'USERNAME_TAKEN' });
  });

  it('lets me change only the case of my own name', async () => {
    expect((await call('PATCH', '/users/me', {}, { username: 'Demo_User' })).username).toBe('Demo_User');
  });
});

describe('mock backend: GET /users/me/events', () => {
  it('lists what I joined (with my status) and what I organise, in start order', async () => {
    const mine = await call('GET', '/users/me/events');
    const joinedIds = mine.joined.map((j: any) => j.event.id);
    expect(joinedIds).toContain(IDS.artWalk);
    expect(mine.joined.find((j: any) => j.event.id === IDS.artWalk).status).toBe('JOINED');
    expect(mine.joined.map((j: any) => j.status)).toEqual(expect.arrayContaining(['ATTENDED', 'NO_SHOW']));
    expect(mine.organizing.map((e: any) => e.id)).toEqual([IDS.sunsetRun]);
    const starts = mine.joined.map((j: any) => Date.parse(j.event.startsAt));
    expect([...starts].sort((a, b) => a - b)).toEqual(starts);
  });

  it('drops events I cancelled', async () => {
    await call('DELETE', `/events/${IDS.artWalk}/join`);
    const mine = await call('GET', '/users/me/events');
    expect(mine.joined.map((j: any) => j.event.id)).not.toContain(IDS.artWalk);
  });

  it('shows an event I just joined', async () => {
    await call('POST', `/events/${IDS.boardGames}/join`);
    const mine = await call('GET', '/users/me/events');
    expect(mine.joined.find((j: any) => j.event.id === IDS.boardGames)?.status).toBe('JOINED');
  });
});

describe('mock backend: GET /users/{id}/reliability', () => {
  it('returns the score and the history, newest first', async () => {
    const history = await call('GET', `/users/${ME}/reliability`);
    expect(history.reliabilityScore).toBe(100);
    expect(history.entries.map((e: any) => e.reason)).toEqual(['NO_SHOW', 'ATTENDED', 'ATTENDED']);
    expect(history.entries[0]).toMatchObject({ pointsChange: -10, eventTitle: 'Open mic night' });
    const times = history.entries.map((e: any) => Date.parse(e.createdAt));
    expect([...times].sort((a, b) => b - a)).toEqual(times);
  });

  it('answers 404 for an unknown user', async () => {
    await expect(call('GET', '/users/unknown/reliability')).rejects.toMatchObject({ status: 404 });
  });

  it('adds an ATTENDED entry when the organiser checks someone in', async () => {
    await call('POST', `/events/${IDS.sunsetRun}/check-in`, {}, { token: 'demo-ticket-stella' });
    const history = await call('GET', `/users/${IDS.stella}/reliability`);
    expect(history.entries[0]).toMatchObject({ pointsChange: 5, reason: 'ATTENDED', eventTitle: 'Sunset run by the Bega' });
    expect(history.reliabilityScore).toBe(95);
  });

  it('adds a LATE_CANCEL entry when I leave less than 2 hours before the start', async () => {
    getMockState().events.find((e) => e.id === IDS.artWalk)!.startsAt = new Date(Date.now() + 3_600_000).toISOString();
    await call('DELETE', `/events/${IDS.artWalk}/join`);
    const history = await call('GET', `/users/${ME}/reliability`);
    expect(history.entries[0]).toMatchObject({ pointsChange: -2, reason: 'LATE_CANCEL' });
    expect(history.reliabilityScore).toBe(98);
  });

  it('keeps no more than 20 entries', async () => {
    const state = getMockState();
    state.reliabilityLog[ME] = Array.from({ length: 25 }, (_, i) => ({
      pointsChange: 5,
      reason: 'ATTENDED' as const,
      eventId: null,
      eventTitle: null,
      createdAt: new Date(Date.now() - i * 1000).toISOString(),
    }));
    expect((await call('GET', `/users/${ME}/reliability`)).entries).toHaveLength(20);
  });
});
