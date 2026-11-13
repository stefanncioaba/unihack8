// Small pure helpers: validation, geo, formatting, new-event form, check-in outcomes, gauge.
import { ApiError, friendlyError } from '@/api/errors';
import { outcomeFromError, outcomeFromSuccess } from '@/features/events/checkInResult';
import { availabilityLabel, isFull, priceLabel, spotsLabel } from '@/features/events/format';
import { defaultStart, emptyForm, validateEventForm } from '@/features/events/newEventForm';
import { gaugeFraction } from '@/features/users/ReliabilityGauge';
import { DEFAULT_POSITION, isValidCoordinate, regionFor, toNearParam } from '@/lib/geo';
import { validateEmail, validatePassword, validateUsername } from '@/lib/validation';
import { reliabilityColor } from '@/ui/ReliabilityBadge';
import { colors } from '@/ui/theme';

describe('validation', () => {
  it('accepts 3–20 letters, digits and underscores for usernames', () => {
    expect(validateUsername('stefan_99')).toBeNull();
    expect(validateUsername('ab')).not.toBeNull();
    expect(validateUsername('has space')).not.toBeNull();
    expect(validateUsername('a'.repeat(21))).not.toBeNull();
  });

  it('checks e-mail shape and password length', () => {
    expect(validateEmail('a@b.ro')).toBeNull();
    expect(validateEmail('nope')).not.toBeNull();
    expect(validatePassword('123456')).toBeNull();
    expect(validatePassword('12345')).not.toBeNull();
  });
});

describe('geo', () => {
  it('defaults to Piața Victoriei', () => {
    expect(DEFAULT_POSITION).toEqual({ lat: 45.7537, lon: 21.2257 });
  });

  it('validates coordinates and builds map regions and near parameters', () => {
    expect(isValidCoordinate(45, 21)).toBe(true);
    expect(isValidCoordinate(91, 21)).toBe(false);
    expect(isValidCoordinate(NaN, 21)).toBe(false);
    expect(regionFor({ lat: 1, lon: 2 }, 0.1)).toEqual({ latitude: 1, longitude: 2, latitudeDelta: 0.1, longitudeDelta: 0.1 });
    expect(toNearParam({ lat: 45.7537, lon: 21.2257 })).toBe('45.75370,21.22570');
  });
});

describe('event labels', () => {
  const base = { source: 'USER' as const, capacity: 12, spotsLeft: 4 };

  it('describes spots for user events', () => {
    expect(spotsLabel(base)).toBe('4 spots left');
    expect(spotsLabel({ ...base, spotsLeft: 1 })).toBe('1 spot left');
    expect(spotsLabel({ ...base, spotsLeft: 0 })).toBe('Full');
    expect(spotsLabel({ ...base, capacity: null, spotsLeft: null })).toBe('Open to all');
    expect(spotsLabel({ ...base, source: 'EXTERNAL' })).toBeNull();
  });

  it('describes prices', () => {
    expect(priceLabel({ priceMin: null, priceMax: null })).toBeNull();
    expect(priceLabel({ priceMin: 0, priceMax: 0 })).toBe('Free');
    expect(priceLabel({ priceMin: 20, priceMax: 20 })).toBe('20 lei');
    expect(priceLabel({ priceMin: 60, priceMax: 120 })).toBe('60–120 lei');
  });

  it('detects full events and picks the right chip text', () => {
    expect(isFull({ ...base, spotsLeft: 0 })).toBe(true);
    expect(isFull({ ...base, source: 'EXTERNAL', spotsLeft: 0 })).toBe(false);
    const ev = { ...base, id: '1', title: 't', category: 'GAMES', venueName: null, lat: null, lon: null, startsAt: '', endsAt: null, imageUrl: null, priceMin: 10, priceMax: 20 };
    expect(availabilityLabel(ev as never)).toBe('4 spots left');
    expect(availabilityLabel({ ...ev, source: 'EXTERNAL' } as never)).toBe('10–20 lei');
  });
});

describe('create-event form', () => {
  const now = Date.parse('2026-11-13T12:00:00Z');

  it('suggests tomorrow at 19:00 Romanian time', () => {
    expect(defaultStart(now)).toBe('2026-11-14T17:00:00.000Z');
  });

  it('reports every missing required field', () => {
    const { errors, payload } = validateEventForm(emptyForm(now), now);
    expect(payload).toBeNull();
    expect(Object.keys(errors).sort()).toEqual(['category', 'point', 'title', 'venueName']);
  });

  it('rejects a start in the past and a bad capacity', () => {
    const form = { ...emptyForm(now), title: 'Run', category: 'SPORT' as const, point: { lat: 1, lon: 2 }, startsAt: '2026-11-13T11:00:00Z', limited: true, capacity: '0' };
    const { errors } = validateEventForm(form, now);
    expect(errors.startsAt).toBeDefined();
    expect(errors.capacity).toBeDefined();
  });

  it('builds the request body, leaving out empty optional fields', () => {
    const form = { ...emptyForm(now), title: '  Run  ', category: 'SPORT' as const, point: { lat: 45.7, lon: 21.2 }, limited: true, capacity: '12', venueName: 'Park' };
    const { errors, payload } = validateEventForm(form, now);
    expect(errors).toEqual({});
    expect(payload).toEqual({
      title: 'Run',
      category: 'SPORT',
      lat: 45.7,
      lon: 21.2,
      startsAt: '2026-11-14T17:00:00.000Z',
      venueName: 'Park',
      capacity: 12,
    });
  });

  it('omits capacity when unlimited', () => {
    const form = { ...emptyForm(now), title: 'Run', category: 'SPORT' as const, point: { lat: 45.7, lon: 21.2 }, venueName: 'Park' };
    expect(validateEventForm(form, now).payload).not.toHaveProperty('capacity');
  });
});

describe('check-in outcomes', () => {
  it('reports success with the points', () => {
    const o = outcomeFromSuccess({ user: { id: '1', username: 'stella_99', reliabilityScore: 95 }, status: 'ATTENDED', pointsChange: 5 });
    expect(o.kind).toBe('success');
    expect(o.title).toContain('stella_99');
    expect(o.message).toContain('+5');
  });

  it.each([
    ['ALREADY_CHECKED_IN', 'warning', 'Already scanned'],
    ['WRONG_EVENT', 'warning', 'Wrong event'],
    ['TICKET_NOT_FOUND', 'error', 'Not a ticket'],
    ['BANNED', 'error', 'Banned participant'],
  ])('maps %s to a %s result', (code, kind, title) => {
    const o = outcomeFromError(new ApiError(409, code, 'x'));
    expect(o).toMatchObject({ kind, title });
  });

  it('falls back to a generic error', () => {
    expect(outcomeFromError(new ApiError(0, 'NETWORK', 'x')).kind).toBe('error');
  });
});

describe('friendlyError', () => {
  it('uses known messages, validation fields and plain errors', () => {
    expect(friendlyError(new ApiError(409, 'EVENT_FULL', 'raw'))).toBe('This event has no free spots left.');
    expect(friendlyError(new ApiError(400, 'VALIDATION_FAILED', 'raw', { title: 'must not be blank' }))).toBe('title: must not be blank');
    expect(friendlyError(new ApiError(418, 'TEAPOT', 'I am a teapot'))).toBe('I am a teapot');
    expect(friendlyError(new Error('boom'))).toBe('boom');
    expect(friendlyError(undefined)).toBe('Something went wrong.');
  });
});

describe('reliability visuals', () => {
  it('fills the gauge proportionally and clamps it', () => {
    expect(gaugeFraction(0)).toBe(0);
    expect(gaugeFraction(75)).toBe(0.5);
    expect(gaugeFraction(500)).toBe(1);
    expect(gaugeFraction(-5)).toBe(0);
  });

  it('colours scores by trust level', () => {
    expect(reliabilityColor(100)).toBe(colors.teal);
    expect(reliabilityColor(75)).toBe(colors.orangeSoft);
    expect(reliabilityColor(30)).toBe(colors.danger);
  });
});
