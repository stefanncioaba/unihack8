// Mock backend for the Neighbour Help Board (docs/API.md → PLAN 25): board, mine, create, offers, tickets, scans, expiry.
import { ApiError } from '@/api/errors';
import { getMockState, mockRequest } from '@test/mocks';

import { HELP, IDS } from './testUtils';

const call = (method: string, path: string, query: Record<string, unknown> = {}, body?: unknown) => mockRequest(method, path, query, body) as Promise<any>;
const ME = '11111111-1111-4111-8111-111111111111';

/** Resolves to the error code a call fails with. */
async function codeOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (e) {
    return (e as ApiError).code;
  }
  throw new Error('expected the call to fail');
}

/** Score of a mock user. */
const score = (id: string) => getMockState().users.find((u) => u.id === id)!.reliabilityScore;

describe('mock backend: GET /help-requests', () => {
  it('lists only open, unexpired requests, newest first, with my offer and the offer count', async () => {
    const board = await call('GET', '/help-requests');
    expect(board.map((r: any) => r.id)).toEqual([HELP.dogWalk, HELP.ladder, HELP.sofa, HELP.bike, HELP.parcel]);
    expect(board.find((r: any) => r.id === HELP.sofa)).toMatchObject({ offerCount: 2, myOffer: null, requester: { username: 'demo_user' } });
    expect(board.find((r: any) => r.id === HELP.dogWalk)).toMatchObject({ myOffer: 'OFFERED', status: 'OPEN' });
    const created = Date.parse(board[0].createdAt);
    expect(Date.parse(board[0].expiresAt) - created).toBe(24 * 3_600_000);
  });

  it('sorts by distance with near, requests without a location last', async () => {
    const board = await call('GET', '/help-requests', { near: '45.7507,21.2297' });
    expect(board[0].id).toBe(HELP.dogWalk);
    expect(board[board.length - 1].id).toBe(HELP.parcel);
    expect(await codeOf(call('GET', '/help-requests', { near: 'x,y' }))).toBe('VALIDATION_FAILED');
  });

  it('keeps only located requests inside a bbox (edges included), combined with near', async () => {
    // Around the old town: the sofa (45.7558, 21.2292), the dog walk (45.7507, 21.2297) and the bike (45.7537, 21.2251).
    const box = '21.2251,45.7500,21.2300,45.7560';
    const inside = await call('GET', '/help-requests', { bbox: box });
    expect(inside.map((r: any) => r.id)).toEqual([HELP.dogWalk, HELP.sofa, HELP.bike]);
    expect(inside.map((r: any) => r.id)).not.toContain(HELP.parcel); // no location
    const sorted = await call('GET', '/help-requests', { bbox: box, near: '45.7558,21.2292' });
    expect(sorted.map((r: any) => r.id)).toEqual([HELP.sofa, HELP.bike, HELP.dogWalk]);
    expect(await call('GET', '/help-requests', { bbox: '0,0,1,1' })).toEqual([]);
    for (const bad of ['1,2,3', 'a,b,c,d', '21.3,45.7,21.2,45.8']) {
      expect(await codeOf(call('GET', '/help-requests', { bbox: bad }))).toBe('VALIDATION_FAILED');
    }
  });

  it('hides a request 24 hours after it was posted', async () => {
    const r = getMockState().helpRequests.find((x) => x.id === HELP.ladder)!;
    r.expiresAt = new Date(Date.now() - 1000).toISOString();
    const board = await call('GET', '/help-requests');
    expect(board.map((x: any) => x.id)).not.toContain(HELP.ladder);
    expect((await call('GET', `/help-requests/${HELP.ladder}`)).status).toBe('EXPIRED');
    expect(await codeOf(call('POST', `/help-requests/${HELP.ladder}/offers`))).toBe('HELP_CLOSED');
  });
});

describe('mock backend: GET /help-requests/mine', () => {
  it('returns my requests and the ones I offered on in every status, newest first', async () => {
    const mine = await call('GET', '/help-requests/mine');
    expect(mine.requested.map((r: any) => r.id)).toEqual([HELP.sofa]);
    expect(mine.offered.map((r: any) => r.id)).toEqual([HELP.dogWalk, HELP.groceries]);
    expect(mine.offered[1]).toMatchObject({ status: 'HELPED', myOffer: 'NOT_NEEDED' });
  });

  it('leaves out withdrawn offers', async () => {
    await call('DELETE', `/help-requests/${HELP.dogWalk}/offers/me`);
    expect((await call('GET', '/help-requests/mine')).offered.map((r: any) => r.id)).toEqual([HELP.groceries]);
  });
});

describe('mock backend: POST /help-requests', () => {
  it('validates title, description, address, category and lat/lon', async () => {
    const bad = async (body: object) => {
      try {
        await call('POST', '/help-requests', {}, body);
      } catch (e) {
        return (e as ApiError).fields;
      }
      throw new Error('expected 400');
    };
    expect(await bad({ title: 'ab', category: 'BORROW' })).toHaveProperty('title');
    expect(await bad({ title: 'x'.repeat(81), category: 'BORROW' })).toHaveProperty('title');
    expect(await bad({ title: 'Fine title', category: 'NOPE' })).toHaveProperty('category');
    expect(await bad({ title: 'Fine title', category: 'PETS', description: 'x'.repeat(501) })).toHaveProperty('description');
    expect(await bad({ title: 'Fine title', category: 'PETS', address: 'x'.repeat(121) })).toHaveProperty('address');
    expect(await bad({ title: 'Fine title', category: 'PETS', lat: 45.7 })).toHaveProperty('lat');
    expect(await bad({ title: 'Fine title', category: 'PETS', lat: 99, lon: 21 })).toHaveProperty('lat');
  });

  it('creates an open request for 24 hours, owned by me, on top of the board', async () => {
    const created = await call('POST', '/help-requests', {}, { title: '  Jump-start my car  ', category: 'REPAIRS', lat: 45.75, lon: 21.22 });
    expect(created).toMatchObject({ title: 'Jump-start my car', status: 'OPEN', isRequester: true, canOffer: false, offers: [], offerCount: 0, description: null, address: null });
    expect(Date.parse(created.expiresAt) - Date.parse(created.createdAt)).toBe(24 * 3_600_000);
    expect((await call('GET', '/help-requests'))[0].id).toBe(created.id);
  });
});

describe('mock backend: GET /help-requests/{id}', () => {
  it('lists offers oldest first without withdrawn ones, and tells the requester apart', async () => {
    const sofa = await call('GET', `/help-requests/${HELP.sofa}`);
    expect(sofa.offers.map((o: any) => o.user.username)).toEqual(['stella_99', 'andrei_tm']);
    expect(sofa).toMatchObject({ isRequester: true, canOffer: false, helper: null, closedAt: null });
    expect(await call('GET', `/help-requests/${HELP.ladder}`)).toMatchObject({ isRequester: false, canOffer: true, description: 'Changing a bulb in the hallway.' });
  });

  it('keeps closed and expired requests readable, with the helper', async () => {
    expect(await call('GET', `/help-requests/${HELP.groceries}`)).toMatchObject({ status: 'HELPED', helper: { username: 'andrei_tm' }, canOffer: false });
    expect(await call('GET', `/help-requests/${HELP.plants}`)).toMatchObject({ status: 'EXPIRED', canOffer: false });
    expect(await codeOf(call('GET', '/help-requests/unknown'))).toBe('NOT_FOUND');
  });
});

describe('mock backend: offers', () => {
  it('offers, refuses a second offer, withdraws for free and re-offers with the same QR token', async () => {
    const first = await call('POST', `/help-requests/${HELP.ladder}/offers`);
    expect(first).toMatchObject({ requestId: HELP.ladder, status: 'OFFERED' });
    expect(first.qrToken).toBeTruthy();
    expect(await codeOf(call('POST', `/help-requests/${HELP.ladder}/offers`))).toBe('ALREADY_OFFERED');
    expect((await call('GET', `/help-requests/${HELP.ladder}`)).offerCount).toBe(2);

    expect(await call('DELETE', `/help-requests/${HELP.ladder}/offers/me`)).toEqual({ requestId: HELP.ladder, status: 'WITHDRAWN' });
    expect(score(ME)).toBe(100);
    expect(await call('GET', `/help-requests/${HELP.ladder}`)).toMatchObject({ offerCount: 1, myOffer: 'WITHDRAWN', canOffer: true });
    expect(await codeOf(call('GET', `/help-requests/${HELP.ladder}/my-ticket`))).toBe('NOT_OFFERED');

    const again = await call('POST', `/help-requests/${HELP.ladder}/offers`);
    expect(again.qrToken).toBe(first.qrToken);
  });

  it('refuses my own request, closed requests and withdrawing without an offer', async () => {
    expect(await codeOf(call('POST', `/help-requests/${HELP.sofa}/offers`))).toBe('IS_REQUESTER');
    expect(await codeOf(call('POST', `/help-requests/${HELP.groceries}/offers`))).toBe('HELP_CLOSED');
    expect(await codeOf(call('POST', `/help-requests/${HELP.plants}/offers`))).toBe('HELP_CLOSED');
    expect(await codeOf(call('DELETE', `/help-requests/${HELP.ladder}/offers/me`))).toBe('NOT_OFFERED');
    expect(await codeOf(call('DELETE', `/help-requests/${HELP.groceries}/offers/me`))).toBe('HELP_CLOSED');
  });

  it('returns my ticket with its status', async () => {
    expect(await call('GET', `/help-requests/${HELP.dogWalk}/my-ticket`)).toEqual({ requestId: HELP.dogWalk, qrToken: 'demo-help-ticket-me-3', status: 'OFFERED' });
    expect((await call('GET', `/help-requests/${HELP.groceries}/my-ticket`)).status).toBe('NOT_NEEDED');
    expect(await codeOf(call('GET', `/help-requests/${HELP.ladder}/my-ticket`))).toBe('NOT_OFFERED');
  });
});

describe('mock backend: POST /help-requests/{id}/check-in', () => {
  const scan = (id: string, token: string) => call('POST', `/help-requests/${id}/check-in`, {}, { token });

  it('closes the request on the first scan: +5 to that helper only, other offers not needed', async () => {
    const result = await scan(HELP.sofa, 'demo-help-ticket-stella');
    expect(result).toEqual({ user: { id: IDS.stella, username: 'stella_99', reliabilityScore: 95 }, status: 'HELPED', pointsChange: 5 });
    expect(score(IDS.stella)).toBe(95);
    expect(score(IDS.andrei)).toBe(105);
    expect(score(ME)).toBe(100);
    expect(getMockState().reliabilityLog[IDS.stella][0]).toMatchObject({ reason: 'HELPED', pointsChange: 5, eventId: null });

    const sofa = await call('GET', `/help-requests/${HELP.sofa}`);
    expect(sofa).toMatchObject({ status: 'HELPED', helper: { username: 'stella_99' } });
    expect(sofa.closedAt).toBeTruthy();
    expect(sofa.offers.map((o: any) => o.status)).toEqual(['HELPED', 'NOT_NEEDED']);
    expect((await call('GET', '/help-requests')).map((r: any) => r.id)).not.toContain(HELP.sofa);

    // A second scan (any helper) is refused.
    expect(await codeOf(scan(HELP.sofa, 'demo-help-ticket-andrei'))).toBe('HELP_CLOSED');
    expect(await codeOf(scan(HELP.sofa, 'demo-help-ticket-stella'))).toBe('HELP_CLOSED');
    expect(score(IDS.stella)).toBe(95);
  });

  it('maps every refusal to its code', async () => {
    expect(await codeOf(scan(HELP.sofa, '  '))).toBe('VALIDATION_FAILED');
    expect(await codeOf(scan(HELP.ladder, 'demo-help-ticket-stella-1'))).toBe('NOT_REQUESTER');
    expect(await codeOf(scan(HELP.sofa, 'not-a-ticket'))).toBe('TICKET_NOT_FOUND');
    expect(await codeOf(scan(HELP.sofa, 'demo-help-ticket-stella-1'))).toBe('WRONG_REQUEST');
    expect(await codeOf(scan(HELP.sofa, 'demo-help-ticket-maria'))).toBe('NOT_OFFERED');
    expect(await codeOf(scan('unknown', 'demo-help-ticket-stella'))).toBe('NOT_FOUND');
  });
});

describe('mock backend: DELETE /help-requests/{id}', () => {
  it('lets only the requester cancel an open request, for free', async () => {
    expect(await codeOf(call('DELETE', `/help-requests/${HELP.ladder}`))).toBe('NOT_REQUESTER');
    const cancelled = await call('DELETE', `/help-requests/${HELP.sofa}`);
    expect(cancelled.status).toBe('CANCELLED');
    expect(score(ME)).toBe(100);
    expect((await call('GET', '/help-requests')).map((r: any) => r.id)).not.toContain(HELP.sofa);
    expect(await codeOf(call('DELETE', `/help-requests/${HELP.sofa}`))).toBe('HELP_CLOSED');
    expect(await codeOf(call('POST', `/help-requests/${HELP.sofa}/check-in`, {}, { token: 'demo-help-ticket-stella' }))).toBe('HELP_CLOSED');
  });
});
