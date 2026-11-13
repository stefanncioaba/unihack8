// The single API client. Adds the Supabase token to every request and, when USE_MOCKS is on,
// answers from src/mocks/ instead of the network.
import { API_URL, USE_MOCKS } from '@/config';
import { supabase } from '@/lib/supabase';
import { mockRequest } from '@/mocks';

import { ApiError } from './errors';

export type QueryValue = string | number | boolean | null | undefined | (string | number)[];
export type QueryParams = Record<string, QueryValue>;
export type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE';
export type RequestOptions = { query?: QueryParams; body?: unknown; signal?: AbortSignal };

const TIMEOUT_MS = 15_000;

/** Builds `?a=1&b=x&b=y`: skips empty values and repeats keys for arrays (e.g. `category`). */
export function buildQuery(query?: QueryParams): string {
  if (!query) return '';
  const parts: string[] = [];
  for (const [key, value] of Object.entries(query)) {
    const values = Array.isArray(value) ? value : [value];
    for (const v of values) {
      if (v === undefined || v === null || v === '') continue;
      parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(v))}`);
    }
  }
  return parts.length ? `?${parts.join('&')}` : '';
}

/** Reads the current access token (null when signed out). */
async function accessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

/** Converts an error answer body into an ApiError, tolerating non-JSON bodies. */
function toApiError(status: number, body: unknown): ApiError {
  const b = (body ?? {}) as { code?: string; message?: string; fields?: Record<string, string> | null };
  return new ApiError(status, b.code ?? 'INTERNAL_ERROR', b.message ?? `Request failed (${status})`, b.fields ?? null);
}

/** Calls the API (or the mocks) and returns the parsed JSON. Throws ApiError on any failure. */
export async function api<T>(method: Method, path: string, options: RequestOptions = {}): Promise<T> {
  if (USE_MOCKS) {
    return (await mockRequest(method, path, options.query ?? {}, options.body)) as T;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  options.signal?.addEventListener('abort', () => controller.abort());

  try {
    const token = await accessToken();
    const response = await fetch(`${API_URL}${path}${buildQuery(options.query)}`, {
      method,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });

    if (response.status === 204) return undefined as T;
    const text = await response.text();
    const json = text ? safeJson(text) : null;
    if (!response.ok) throw toApiError(response.status, json);
    return json as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (controller.signal.aborted && !options.signal?.aborted) throw new ApiError(0, 'TIMEOUT', 'Request timed out');
    throw new ApiError(0, 'NETWORK', 'Network request failed');
  } finally {
    clearTimeout(timer);
  }
}

/** JSON.parse that returns null instead of throwing. */
function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
