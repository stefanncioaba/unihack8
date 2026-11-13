// Create-event form: default values, validation and the request body (PLAN 13.5).
import type { EventCategory, NewEvent } from '@/api/types';
import type { Coordinates } from '@/lib/geo';
import { bucharestToUtcIso, toBucharest } from '@/lib/time';

export type EventForm = {
  title: string;
  description: string;
  category: EventCategory | null;
  /** UTC ISO time of the start. */
  startsAt: string;
  /** False = unlimited spots. */
  limited: boolean;
  capacity: string;
  venueName: string;
  address: string;
  point: Coordinates | null;
};

export type FormErrors = Partial<Record<'title' | 'category' | 'startsAt' | 'capacity' | 'point' | 'venueName', string>>;

/** Tomorrow at 19:00 (Bucharest time), the suggested start. */
export function defaultStart(now: number = Date.now()): string {
  const t = toBucharest(now);
  const d = new Date(Date.UTC(t.year, t.month - 1, t.day + 1));
  return bucharestToUtcIso({ year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate(), hour: 19, minute: 0 });
}

/** A blank form with sensible defaults. */
export function emptyForm(now: number = Date.now()): EventForm {
  return {
    title: '',
    description: '',
    category: null,
    startsAt: defaultStart(now),
    limited: false,
    capacity: '10',
    venueName: '',
    address: '',
    point: null,
  };
}

/** Checks the form against the API rules (docs/API.md). `payload` is null when anything is wrong. */
export function validateEventForm(form: EventForm, now: number = Date.now()): { errors: FormErrors; payload: NewEvent | null } {
  const errors: FormErrors = {};
  const title = form.title.trim();
  if (!title) errors.title = 'Give your event a title.';
  else if (title.length > 120) errors.title = 'Keep the title under 120 characters.';
  if (!form.category) errors.category = 'Pick a category.';
  if (!form.venueName.trim()) errors.venueName = 'Give your event a venue name.';
  if (Date.parse(form.startsAt) <= now) errors.startsAt = 'The start must be in the future.';
  if (!form.point) errors.point = 'Choose the location on the map.';

  let capacity: number | undefined;
  if (form.limited) {
    capacity = Number(form.capacity);
    if (!Number.isInteger(capacity) || capacity < 1) errors.capacity = 'Enter a whole number, 1 or more.';
  }

  if (Object.keys(errors).length > 0 || !form.category || !form.point) return { errors, payload: null };

  const payload: NewEvent = {
    title,
    category: form.category,
    lat: form.point.lat,
    lon: form.point.lon,
    startsAt: form.startsAt,
    ...(form.description.trim() ? { description: form.description.trim() } : {}),
    venueName: form.venueName.trim(),
    ...(form.address.trim() ? { address: form.address.trim() } : {}),
    ...(capacity !== undefined ? { capacity } : {}),
  };
  return { errors, payload };
}
