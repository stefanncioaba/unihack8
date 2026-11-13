// Date helpers: Bucharest time, DST, filter ranges.
import {
  bucharestOffsetMs,
  bucharestToUtcIso,
  dateRangeFor,
  formatDate,
  formatDay,
  formatEventDate,
  formatTime,
  minutesUntil,
  toBucharest,
} from '@/lib/time';

const HOUR = 3_600_000;

describe('Bucharest time', () => {
  it('uses UTC+2 in winter and UTC+3 in summer', () => {
    expect(bucharestOffsetMs(Date.UTC(2026, 10, 14, 12))).toBe(2 * HOUR);
    expect(bucharestOffsetMs(Date.UTC(2026, 6, 14, 12))).toBe(3 * HOUR);
  });

  it('switches at 01:00 UTC on the last Sunday of March and October', () => {
    // 2026: DST starts Sunday 29 March, ends Sunday 25 October.
    expect(bucharestOffsetMs(Date.UTC(2026, 2, 29, 0, 59))).toBe(2 * HOUR);
    expect(bucharestOffsetMs(Date.UTC(2026, 2, 29, 1, 0))).toBe(3 * HOUR);
    expect(bucharestOffsetMs(Date.UTC(2026, 9, 25, 0, 59))).toBe(3 * HOUR);
    expect(bucharestOffsetMs(Date.UTC(2026, 9, 25, 1, 0))).toBe(2 * HOUR);
  });

  it('formats event dates in Romanian time', () => {
    expect(formatTime('2026-11-14T17:00:00Z')).toBe('19:00');
    expect(formatDay('2026-11-14T17:00:00Z')).toBe('Sat, 14 Nov');
    expect(formatEventDate('2026-11-14T17:00:00Z')).toBe('Sat, 14 Nov · 19:00');
    expect(formatDate('2026-11-14T17:00:00Z')).toBe('14 Nov 2026');
  });

  it('rolls into the next day when the offset crosses midnight', () => {
    expect(toBucharest('2026-11-14T22:30:00Z')).toMatchObject({ day: 15, hour: 0, minute: 30 });
  });

  it('converts wall-clock time back to UTC, in both seasons', () => {
    expect(bucharestToUtcIso({ year: 2026, month: 11, day: 14, hour: 19, minute: 0 })).toBe('2026-11-14T17:00:00.000Z');
    expect(bucharestToUtcIso({ year: 2026, month: 7, day: 14, hour: 19, minute: 0 })).toBe('2026-07-14T16:00:00.000Z');
  });

  it('round-trips through toBucharest', () => {
    const iso = '2026-12-31T21:45:00.000Z';
    const t = toBucharest(iso);
    expect(bucharestToUtcIso(t)).toBe(iso);
  });
});

describe('date filter ranges', () => {
  // Wednesday 11 Nov 2026, 12:00 Romanian time.
  const wed = Date.parse('2026-11-11T10:00:00Z');

  it('has no limits for "any date"', () => {
    expect(dateRangeFor('ANY', wed)).toEqual({});
  });

  it('today runs from now to Bucharest midnight', () => {
    expect(dateRangeFor('TODAY', wed)).toEqual({ from: '2026-11-11T10:00:00.000Z', to: '2026-11-11T22:00:00.000Z' });
  });

  it('tomorrow is one whole Bucharest day', () => {
    expect(dateRangeFor('TOMORROW', wed)).toEqual({ from: '2026-11-11T22:00:00.000Z', to: '2026-11-12T22:00:00.000Z' });
  });

  it('weekend is Saturday 00:00 to Monday 00:00', () => {
    expect(dateRangeFor('WEEKEND', wed)).toEqual({ from: '2026-11-13T22:00:00.000Z', to: '2026-11-15T22:00:00.000Z' });
  });

  it('weekend starts now when it is already Sunday', () => {
    const sun = Date.parse('2026-11-15T10:00:00Z');
    const range = dateRangeFor('WEEKEND', sun);
    expect(range.from).toBe('2026-11-15T10:00:00.000Z');
    expect(range.to).toBe('2026-11-15T22:00:00.000Z');
  });

  it('"next 7 days" ends at midnight seven days ahead', () => {
    expect(dateRangeFor('WEEK', wed)).toEqual({ from: '2026-11-11T10:00:00.000Z', to: '2026-11-17T22:00:00.000Z' });
  });
});

describe('minutesUntil', () => {
  it('is positive for the future and negative for the past', () => {
    const now = Date.parse('2026-11-14T10:00:00Z');
    expect(minutesUntil('2026-11-14T11:00:00Z', now)).toBe(60);
    expect(minutesUntil('2026-11-14T09:30:00Z', now)).toBe(-30);
  });
});
