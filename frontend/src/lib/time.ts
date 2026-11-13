// Date helpers. The API speaks UTC; the app shows Romanian time (Europe/Bucharest).
// Done by hand (EET/EEST rules) instead of Intl so the result is identical on every phone.

const HOUR = 3_600_000;
const MINUTE = 60_000;

export type WallTime = { year: number; month: number; day: number; hour: number; minute: number; weekday: number };

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** UTC timestamp (ms) of 01:00 UTC on the last Sunday of the given month (month is 0-based). */
function lastSundayAt01Utc(year: number, month: number): number {
  const lastDay = new Date(Date.UTC(year, month + 1, 0));
  const back = lastDay.getUTCDay(); // 0 = Sunday
  return Date.UTC(year, month, lastDay.getUTCDate() - back, 1);
}

/** Offset of Bucharest from UTC in ms at a UTC instant: +2 h in winter, +3 h in summer. */
export function bucharestOffsetMs(utcMs: number): number {
  const year = new Date(utcMs).getUTCFullYear();
  const dstStart = lastSundayAt01Utc(year, 2);
  const dstEnd = lastSundayAt01Utc(year, 9);
  return utcMs >= dstStart && utcMs < dstEnd ? 3 * HOUR : 2 * HOUR;
}

/**
 * Parses an ISO time from the API. Postgres times can carry microseconds (`…:00.123456Z`); fractions are cut to
 * milliseconds first because not every JS engine accepts more than 3 fraction digits.
 */
export function parseIso(iso: string): number {
  return Date.parse(iso.replace(/(\.\d{3})\d+/, '$1'));
}

/** Breaks a UTC instant into Bucharest wall-clock parts. */
export function toBucharest(input: string | number | Date): WallTime {
  const utcMs = input instanceof Date ? input.getTime() : typeof input === 'number' ? input : parseIso(input);
  const shifted = new Date(utcMs + bucharestOffsetMs(utcMs));
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
    weekday: shifted.getUTCDay(),
  };
}

/** Converts Bucharest wall-clock fields to a UTC ISO string. */
export function bucharestToUtcIso(w: Omit<WallTime, 'weekday'>): string {
  const wall = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute);
  const summer = wall - 3 * HOUR;
  const utc = bucharestOffsetMs(summer) === 3 * HOUR ? summer : wall - 2 * HOUR;
  return new Date(utc).toISOString();
}

/** Two-digit zero padding. */
function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** `19:00` in Bucharest time. */
export function formatTime(iso: string): string {
  const t = toBucharest(iso);
  return `${pad(t.hour)}:${pad(t.minute)}`;
}

/** `Sat, 14 Nov` in Bucharest time. */
export function formatDay(iso: string | number | Date): string {
  const t = toBucharest(iso);
  return `${WEEKDAYS[t.weekday]}, ${t.day} ${MONTHS[t.month - 1]}`;
}

/** `13 Nov 2026` in Bucharest time. */
export function formatDate(iso: string): string {
  const t = toBucharest(iso);
  return `${t.day} ${MONTHS[t.month - 1]} ${t.year}`;
}

/** `Sat, 14 Nov · 19:00`: the standard event date line. */
export function formatEventDate(iso: string): string {
  return `${formatDay(iso)} · ${formatTime(iso)}`;
}

/** Bucharest midnight (as a UTC ISO string) of the day containing `now`, shifted by `addDays`. */
export function startOfBucharestDayIso(now: number | Date, addDays = 0): string {
  const t = toBucharest(now);
  const base = new Date(Date.UTC(t.year, t.month - 1, t.day + addDays));
  return bucharestToUtcIso({
    year: base.getUTCFullYear(),
    month: base.getUTCMonth() + 1,
    day: base.getUTCDate(),
    hour: 0,
    minute: 0,
  });
}

export type DatePreset = 'ANY' | 'TODAY' | 'TOMORROW' | 'WEEKEND' | 'WEEK';

export const DATE_PRESETS: { key: DatePreset; label: string }[] = [
  { key: 'ANY', label: 'Any date' },
  { key: 'TODAY', label: 'Today' },
  { key: 'TOMORROW', label: 'Tomorrow' },
  { key: 'WEEKEND', label: 'This weekend' },
  { key: 'WEEK', label: 'Next 7 days' },
];

/** Turns a date filter chip into the `from` / `to` query parameters (undefined = no limit). */
export function dateRangeFor(preset: DatePreset, now: number | Date = Date.now()): { from?: string; to?: string } {
  const nowMs = new Date(now).getTime();
  const today = toBucharest(nowMs);
  switch (preset) {
    case 'TODAY':
      return { from: new Date(nowMs).toISOString(), to: startOfBucharestDayIso(nowMs, 1) };
    case 'TOMORROW':
      return { from: startOfBucharestDayIso(nowMs, 1), to: startOfBucharestDayIso(nowMs, 2) };
    case 'WEEKEND': {
      // Saturday 00:00 to Monday 00:00; if the weekend already started, begin now.
      const toSaturday = today.weekday === 0 ? -1 : 6 - today.weekday;
      const saturday = startOfBucharestDayIso(nowMs, toSaturday);
      const from = Date.parse(saturday) < nowMs ? new Date(nowMs).toISOString() : saturday;
      return { from, to: startOfBucharestDayIso(nowMs, toSaturday + 2) };
    }
    case 'WEEK':
      return { from: new Date(nowMs).toISOString(), to: startOfBucharestDayIso(nowMs, 7) };
    default:
      return {};
  }
}

/** Whole minutes from now until an ISO time (negative when in the past). */
export function minutesUntil(iso: string, now: number = Date.now()): number {
  return Math.round((Date.parse(iso) - now) / MINUTE);
}
