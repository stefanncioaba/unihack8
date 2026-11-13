// Client-side checks that mirror the backend rules (see docs/API.md) so users get instant feedback.

const USERNAME_RE = /^[A-Za-z0-9_]{3,20}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Username rule: 3–20 letters, digits or underscore. Returns an error message or null. */
export function validateUsername(value: string): string | null {
  return USERNAME_RE.test(value) ? null : 'Use 3–20 letters, digits or underscores.';
}

/** Basic e-mail shape check. Returns an error message or null. */
export function validateEmail(value: string): string | null {
  return EMAIL_RE.test(value.trim()) ? null : 'Enter a valid e-mail address.';
}

/** Supabase requires at least 6 characters. Returns an error message or null. */
export function validatePassword(value: string): string | null {
  return value.length >= 6 ? null : 'Use at least 6 characters.';
}
