// Ask-for-help form: blank values, validation (the API rules, plus a required pin) and the request body (PLAN 25).
import {
  HELP_ADDRESS_MAX,
  HELP_DESCRIPTION_MAX,
  HELP_TITLE_MAX,
  HELP_TITLE_MIN,
  type HelpCategory,
  type NewHelpRequest,
} from '@/api/types.help';
import { isValidCoordinate, type Coordinates } from '@/lib/geo';

export type HelpForm = {
  title: string;
  description: string;
  category: HelpCategory | null;
  address: string;
  /** Pin on the map (required, so the request lands in a neighbourhood); pre-filled with the phone's position. */
  point: Coordinates | null;
};

export type HelpFormErrors = Partial<Record<'title' | 'description' | 'category' | 'address' | 'point', string>>;

/** An empty form. */
export function emptyHelpForm(): HelpForm {
  return { title: '', description: '', category: null, address: '', point: null };
}

/** Checks the form against docs/API.md. `payload` is null when anything is wrong. */
export function validateHelpForm(form: HelpForm): { errors: HelpFormErrors; payload: NewHelpRequest | null } {
  const errors: HelpFormErrors = {};
  const title = form.title.trim();
  const description = form.description.trim();
  const address = form.address.trim();

  if (!title) errors.title = 'Say what you need help with.';
  else if (title.length < HELP_TITLE_MIN) errors.title = `Use at least ${HELP_TITLE_MIN} characters.`;
  else if (title.length > HELP_TITLE_MAX) errors.title = `Keep the title under ${HELP_TITLE_MAX} characters.`;
  if (description.length > HELP_DESCRIPTION_MAX) errors.description = `Keep the description under ${HELP_DESCRIPTION_MAX} characters.`;
  if (!form.category) errors.category = 'Pick a category.';
  if (address.length > HELP_ADDRESS_MAX) errors.address = `Keep the address under ${HELP_ADDRESS_MAX} characters.`;
  if (!form.point) errors.point = 'Pin where you need help.';
  else if (!isValidCoordinate(form.point.lat, form.point.lon)) errors.point = 'Choose the location again.';

  if (Object.keys(errors).length > 0 || !form.category || !form.point) return { errors, payload: null };

  const payload: NewHelpRequest = {
    title,
    category: form.category,
    ...(description ? { description } : {}),
    ...(address ? { address } : {}),
    lat: form.point.lat,
    lon: form.point.lon,
  };
  return { errors, payload };
}
