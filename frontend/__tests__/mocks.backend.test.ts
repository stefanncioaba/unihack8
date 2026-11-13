// The mock backend must behave like docs/API.md, because screens are built against it.
import { ApiError } from '@/api/errors';
import { mockRequest } from '@test/mocks';

import { IDS } from './testUtils';

const call = (method: string, path: string, query: Record<string, unknown> = {}, body?: unknown) => mockRequest(method, path, query, body) as Promise<any>;

describe('mock backend: events', () => {
  it('lists upcoming events in start order with paging', async () => {
    const page0 = await call('GET', '/events', { size: 10 });
    expect(page0).toMatchObject({ page: 0, size: 10, totalItems: 14, totalPages: 2 });
    expect(page0.items).toHaveLength(10);
    const starts = page0.items.map((e: any) => Date.parse(e.startsAt));
    expect([...starts].sort((a, b) => a - b)).toEqual(starts);
    const page1 = await call('GET', '/events', { size: 10, page: 1 });
    expect(page1.items).toHaveLength(4);
  });

  it('filters by text, category (repeatable or comma-separated) and source', async () => {
    expect((await call('GET', '/events', { q: 'GAMES NIGHT' })).items.map((e: any) => e.id)).toEqual([IDS.boardGames]);
    const sports = await call('GET', '/events', { category: ['SPORT'] });
    expect(sports.items.every((e: any) => e.category === 'SPORT')).toBe(true);
    const two = await call('GET', '/events', { category: 'SPORT,ART' });
    expect(new Set(two.items.map((e: any) => e.category))).toEqual(new Set(['SPORT', 'ART']));
    expect((await call('GET', '/events', { source: 'EXTERNAL' })).items.every((e: any) => e.source === 'EXTERNAL')).toBe(true);
  });

  it('filters by date range', async () => {
    const all = await call('GET', '/events', { size: 100 });
    const first = all.items[0];
    const none = await call('GET', '/events', { to: new Date(Date.now() + 60_000).toISOString() });
    expect(none.items).toEqual([]);
    const some = await call('GET', '/events', { from: first.startsAt, to: new Date(Date.parse(first.startsAt) + 1000).toISOString() });
    expect(some.items.map((e: any) => e.id)).toContain(first.id);
  });

  it('returns details with spots left, organiser and my status', async () => {
    const e = await call('GET', `/events/${IDS.boardGames}`);
    expect(e).toMatchObject({ capacity: 12, spotsLeft: 4, participantCount: 8, myStatus: null });
    expect(e.organizer.username).toBe('stefan');
    expect((await call('GET', `/events/${IDS.artWalk}`)).myStatus).toBe('JOINED');
    await expect(call('GET', '/events/nope')).rejects.toMatchObject({ status: 404, code: 'NOT_FOUND' });
  });
});

describe('mock backend: join and leave', () => {
  it('joins, takes a spot, and rejects a second join', async () => {
    const res = await call('POST', `/events/${IDS.boardGames}/join`);
    expect(res).toMatchObject({ eventId: IDS.boardGames, status: 'JOINED' });
    expect(res.qrToken).toBeTruthy();
    expect((await call('GET', `/events/${IDS.boardGames}`)).spotsLeft).toBe(3);
    await expect(call('POST', `/events/${IDS.boardGames}/join`)).rejects.toMatchObject({ code: 'ALREADY_JOINED' });
  });

  it('rejects full, organiser and external joins', async () => {
    await expect(call('POST', `/events/${IDS.picnic}/join`)).rejects.toMatchObject({ code: 'EVENT_FULL' });
    await expect(call('POST', `/events/${IDS.sunsetRun}/join`)).rejects.toMatchObject({ code: 'IS_ORGANIZER' });
    await expect(call('POST', `/events/${IDS.indieRock}/join`)).rejects.toMatchObject({ code: 'EXTERNAL_EVENT' });
  });

  it('leaves without a penalty when the event is far away and keeps the same ticket on re-join', async () => {
    const joined = await call('POST', `/events/${IDS.boardGames}/join`);
    const left = await call('DELETE', `/events/${IDS.boardGames}/join`);
    expect(left).toEqual({ status: 'CANCELLED', pointsChange: 0, reliabilityScore: 100 });
    await expect(call('DELETE', `/events/${IDS.boardGames}/join`)).rejects.toMatchObject({ code: 'NOT_JOINED' });
    expect((await call('POST', `/events/${IDS.boardGames}/join`)).qrToken).toBe(joined.qrToken);
  });

  it('gives a ticket only to participants', async () => {
    await expect(call('GET', `/events/${IDS.boardGames}/my-ticket`)).rejects.toMatchObject({ code: 'NOT_JOINED' });
    expect(await call('GET', `/events/${IDS.artWalk}/my-ticket`)).toMatchObject({ qrToken: 'demo-ticket-me-7', status: 'JOINED' });
  });
});

describe('mock backend: create, participants, ban, check-in', () => {
  const payload = { title: 'New', category: 'GAMES', venueName: 'Central Park', lat: 45.7, lon: 21.2, startsAt: new Date(Date.now() + 86_400_000).toISOString(), capacity: 5 };

  it('creates an event organised by me and validates the body', async () => {
    const created = await call('POST', '/events', {}, payload);
    expect(created).toMatchObject({ title: 'New', source: 'USER', capacity: 5, spotsLeft: 5 });
    expect(created.organizer.username).toBe('demo_user');
    expect((await call('GET', `/events/${created.id}`)).title).toBe('New');

    const error = await call('POST', '/events', {}, { ...payload, title: ' ', startsAt: '2020-01-01T00:00:00Z', capacity: 0 }).catch((e) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(Object.keys(error.fields).sort()).toEqual(['capacity', 'startsAt', 'title']);
    await expect(call('POST', '/events', {}, { ...payload, venueName: '' })).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
  });

  it('lists participants with reliability scores', async () => {
    const list = await call('GET', `/events/${IDS.sunsetRun}/participants`);
    expect(list.map((p: any) => p.user.username).sort()).toEqual(['andrei_tm', 'maria_c', 'stella_99']);
    expect(list[0]).toHaveProperty('user.reliabilityScore');
  });

  it('lets only the organiser ban, and a banned user disappears from joined counts', async () => {
    await expect(call('POST', `/events/${IDS.boardGames}/participants/${IDS.stella}/ban`)).rejects.toMatchObject({ code: 'NOT_ORGANIZER' });
    expect(await call('POST', `/events/${IDS.sunsetRun}/participants/${IDS.stella}/ban`)).toEqual({ userId: IDS.stella, status: 'BANNED' });
    expect((await call('GET', `/events/${IDS.sunsetRun}`)).participantCount).toBe(2);
  });

  it('checks a ticket in once, adds 5 points, and reports the error cases', async () => {
    const path = `/events/${IDS.sunsetRun}/check-in`;
    const ok = await call('POST', path, {}, { token: 'demo-ticket-stella' });
    expect(ok).toMatchObject({ status: 'ATTENDED', pointsChange: 5, user: { username: 'stella_99', reliabilityScore: 95 } });
    await expect(call('POST', path, {}, { token: 'demo-ticket-stella' })).rejects.toMatchObject({ code: 'ALREADY_CHECKED_IN' });
    await expect(call('POST', path, {}, { token: 'demo-ticket-stella-1' })).rejects.toMatchObject({ code: 'WRONG_EVENT' });
    await expect(call('POST', path, {}, { token: 'garbage' })).rejects.toMatchObject({ code: 'TICKET_NOT_FOUND' });
    await expect(call('POST', `/events/${IDS.boardGames}/check-in`, {}, { token: 'x' })).rejects.toMatchObject({ code: 'NOT_ORGANIZER' });
    expect((await call('GET', `/users/${IDS.stella}`)).attendedEvents[0].id).toBe(IDS.sunsetRun);
  });
});

describe('mock backend: users and transit', () => {
  it('checks username availability case-insensitively', async () => {
    expect(await call('GET', '/users/username-available', { username: 'STEFAN' })).toEqual({ username: 'STEFAN', available: false });
    expect((await call('GET', '/users/username-available', { username: 'brand_new' })).available).toBe(true);
    await expect(call('GET', '/users/username-available', { username: 'a' })).rejects.toMatchObject({ code: 'INVALID_USERNAME' });
  });

  it('searches by username prefix', async () => {
    expect((await call('GET', '/users/search', { q: 'ste' })).map((u: any) => u.username).sort()).toEqual(['stefan', 'stella_99']);
    expect(await call('GET', '/users/search', { q: ' ' })).toEqual([]);
  });

  it('returns public profiles with attended events', async () => {
    const profile = await call('GET', `/users/${IDS.stella}`);
    expect(profile).toMatchObject({ username: 'stella_99', reliabilityScore: 90 });
    expect(profile.attendedEvents).toHaveLength(2);
    await expect(call('GET', '/users/unknown')).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('answers the transit summary and alerts', async () => {
    const summary = await call('GET', '/transit/summary', { near: '45.7,21.2' });
    expect(summary.message).toMatch(/Last tram/);
    expect(summary.activeAlerts).toBe(1);
    expect(await call('GET', '/transit/alerts')).toHaveLength(1);
  });

  it('answers 404 for unknown endpoints', async () => {
    await expect(call('GET', '/nothing')).rejects.toMatchObject({ status: 404 });
  });
});
