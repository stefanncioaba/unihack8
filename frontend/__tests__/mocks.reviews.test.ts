// Mock backend for event reviews (docs/API.md → Reviews): who may review, the window, averages and settlement.
import { getMockState, mockRequest } from '@test/mocks';
import { ratingPoints, settleIfDue } from '@test/mocks/core';

import { IDS } from './testUtils';

const call = (method: string, path: string, query: Record<string, unknown> = {}, body?: unknown) => mockRequest(method, path, query, body) as Promise<any>;
const ME = '11111111-1111-4111-8111-111111111111';
const STEFAN = '22222222-2222-4222-8222-222222222222';

describe('mock backend: GET /events/{id}/reviews', () => {
  it('returns the average, count, reviews newest first and lets an attendee review', async () => {
    const r = await call('GET', `/events/${IDS.coffeeCupping}/reviews`);
    expect(r).toMatchObject({ averageRating: 4.5, reviewCount: 2, canReview: true, settled: false, myReview: null });
    expect(r.reviews.map((x: any) => x.reviewer.username)).toEqual(['stella_99', 'andrei_tm']);
    expect(Date.parse(r.reviewsCloseAt)).toBeGreaterThan(Date.now());
  });

  it('does not let the organiser or someone who was not checked in review', async () => {
    expect((await call('GET', `/events/${IDS.sushiWorkshop}/reviews`)).canReview).toBe(false);
    expect((await call('GET', `/events/${IDS.boardGames}/reviews`)).canReview).toBe(false);
  });

  it('has no review window for imported events', async () => {
    const r = await call('GET', `/events/${IDS.indieRock}/reviews`);
    expect(r).toMatchObject({ reviewsCloseAt: null, reviewCount: 0, averageRating: null, canReview: false });
  });

  it('carries the rating on event summaries and details', async () => {
    expect(await call('GET', `/events/${IDS.coffeeCupping}`)).toMatchObject({ averageRating: 4.5, reviewCount: 2 });
    expect(await call('GET', `/events/${IDS.boardGames}`)).toMatchObject({ averageRating: null, reviewCount: 0 });
  });
});

describe('mock backend: PUT /events/{id}/reviews/me', () => {
  const path = `/events/${IDS.coffeeCupping}/reviews/me`;

  it('lets a checked-in attendee review, then replaces the review and recomputes the average', async () => {
    const saved = await call('PUT', path, {}, { rating: 3, comment: '  Too short  ' });
    expect(saved).toMatchObject({ rating: 3, comment: 'Too short', reviewer: { id: ME } });
    expect(await call('GET', `/events/${IDS.coffeeCupping}/reviews`)).toMatchObject({ averageRating: 4, reviewCount: 3 });

    await call('PUT', path, {}, { rating: 1, comment: '' });
    const after = await call('GET', `/events/${IDS.coffeeCupping}/reviews`);
    expect(after).toMatchObject({ averageRating: 3.3, reviewCount: 3, myReview: { rating: 1, comment: null } });
    expect(after.reviews[0].reviewer.id).toBe(ME);
  });

  it('rejects a bad rating or a too long comment with VALIDATION_FAILED', async () => {
    await expect(call('PUT', path, {}, { rating: 6 })).rejects.toMatchObject({ status: 400, code: 'VALIDATION_FAILED' });
    await expect(call('PUT', path, {}, { rating: 2.5 })).rejects.toMatchObject({ status: 400 });
    await expect(call('PUT', path, {}, { rating: 4, comment: 'x'.repeat(301) })).rejects.toMatchObject({ fields: { comment: expect.any(String) } });
  });

  it('refuses someone who was not checked in with 403 NOT_ATTENDED', async () => {
    await expect(call('PUT', `/events/${IDS.boardGames}/reviews/me`, {}, { rating: 5 })).rejects.toMatchObject({ status: 403, code: 'NOT_ATTENDED' });
  });

  it('refuses the organiser with 409 IS_ORGANIZER and imported events with 403 EXTERNAL_EVENT', async () => {
    await expect(call('PUT', `/events/${IDS.sushiWorkshop}/reviews/me`, {}, { rating: 5 })).rejects.toMatchObject({ status: 409, code: 'IS_ORGANIZER' });
    await expect(call('PUT', `/events/${IDS.indieRock}/reviews/me`, {}, { rating: 5 })).rejects.toMatchObject({ status: 403, code: 'EXTERNAL_EVENT' });
  });

  it('refuses once the 24-hour window is over with 409 REVIEWS_CLOSED', async () => {
    await expect(call('PUT', `/events/${IDS.photoWalk}/reviews/me`, {}, { rating: 5 })).rejects.toMatchObject({ status: 409, code: 'REVIEWS_CLOSED' });
  });

  it('answers 404 for an unknown event', async () => {
    await expect(call('PUT', '/events/nope/reviews/me', {}, { rating: 5 })).rejects.toMatchObject({ status: 404 });
  });
});

describe('mock backend: organiser settlement', () => {
  it('maps the average to points: ±5 max, at least +1 above 3 and at least −1 at or below 3', () => {
    expect(ratingPoints(5)).toBe(5);
    expect(ratingPoints(4.5)).toBe(4);
    expect(ratingPoints(3.1)).toBe(1);
    expect(ratingPoints(3)).toBe(-1);
    expect(ratingPoints(4)).toBe(3); // 2.5 rounds away from zero to 3
    expect(ratingPoints(2)).toBe(-3); // −2.5 rounds away from zero to −3, like the backend
    expect(ratingPoints(1)).toBe(-5);
  });

  it('applies the points once when the window closes and logs EVENT_RATING', async () => {
    const e = getMockState().events.find((x) => x.id === IDS.coffeeCupping)!;
    e.startsAt = new Date(Date.now() - 40 * 3_600_000).toISOString(); // ended 37 h ago
    const r = await call('GET', `/events/${IDS.coffeeCupping}/reviews`);
    expect(r).toMatchObject({ settled: true, canReview: false });
    settleIfDue(e); // a second time changes nothing
    const history = await call('GET', `/users/${STEFAN}/reliability`);
    expect(history.entries[0]).toMatchObject({ reason: 'EVENT_RATING', pointsChange: 4, eventTitle: 'Coffee cupping morning' });
    expect(history.entries.filter((x: any) => x.reason === 'EVENT_RATING')).toHaveLength(1);
    expect(history.reliabilityScore).toBe(119);
  });
});

describe('mock backend: organised events on public profiles', () => {
  it('lists the user events someone organised that are over, newest first, with ratings', async () => {
    const profile = await call('GET', `/users/${STEFAN}`);
    expect(profile.organizedEvents.map((e: any) => e.title)).toEqual(['Coffee cupping morning', 'Autumn photo walk']);
    expect(profile.organizedEvents[0]).toMatchObject({ averageRating: 4.5, reviewCount: 2 });
    expect((await call('GET', `/users/${IDS.stella}`)).organizedEvents).toEqual([]);
  });
});
