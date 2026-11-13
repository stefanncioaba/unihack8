import { parseMockAreas } from '@/lib/mockAreas';

// Public app configuration. Expo inlines `process.env.EXPO_PUBLIC_*` at build time,
// so each variable must be referenced literally (no dynamic lookups).

/** Base URL of the Spring API on the laptop, without a trailing slash. */
export const API_URL: string = (process.env.EXPO_PUBLIC_API_URL ?? '').replace(/\/+$/, '');

/** Supabase project URL (sign-in only; app data goes through the Spring API). */
export const SUPABASE_URL: string = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';

/** Supabase publishable (or legacy anon) key. Public by design. */
export const SUPABASE_KEY: string = process.env.EXPO_PUBLIC_SUPABASE_KEY ?? '';

/**
 * Which API areas are answered by `src/mocks/`: `true` = all, `false` = none, or a list such as `ai,events`
 * (see lib/mockAreas.ts).
 */
export const MOCK_AREAS = parseMockAreas(process.env.EXPO_PUBLIC_USE_MOCKS);

/** True when at least one area is mocked. */
export const USE_MOCKS: boolean = MOCK_AREAS === 'all' || MOCK_AREAS.length > 0;
