// API client: query building, token header, error mapping (real fetch path), and the USE_MOCKS switch.
import { api, buildQuery } from '@/api/client';
import { ApiError } from '@/api/errors';
import { supabase } from '@/lib/supabase';

// `USE_MOCKS` is read through a getter so each test can flip it.
jest.mock('@/config', () => ({
  API_URL: 'http://api.test:8080',
  SUPABASE_URL: '',
  SUPABASE_KEY: '',
  get USE_MOCKS() {
    return (globalThis as { __useMocks?: boolean }).__useMocks ?? true;
  },
}));

/** Switches the client between the mock backend and real HTTP. */
const useMocks = (on: boolean) => ((globalThis as { __useMocks?: boolean }).__useMocks = on);

/** Makes the mocked Supabase session return this access token (or none). */
const signedInWith = (token: string | null) =>
  (supabase.auth.getSession as jest.Mock).mockResolvedValue({ data: { session: token ? { access_token: token } : null } });

describe('buildQuery', () => {
  it('skips empty values and repeats array keys', () => {
    expect(buildQuery({ q: 'pizza', category: ['CAFE', 'BAR'], from: undefined, to: null, page: 0, empty: '' })).toBe(
      '?q=pizza&category=CAFE&category=BAR&page=0',
    );
  });

  it('encodes special characters and returns an empty string for nothing', () => {
    expect(buildQuery({ q: 'a b&c' })).toBe('?q=a%20b%26c');
    expect(buildQuery({})).toBe('');
    expect(buildQuery(undefined)).toBe('');
  });
});

describe('USE_MOCKS on', () => {
  beforeEach(() => useMocks(true));

  it('serves data from src/mocks without touching fetch', async () => {
    const fetchSpy = jest.spyOn(globalThis, 'fetch');
    const me = await api<{ username: string }>('GET', '/users/me');
    expect(me.username).toBe('demo_user');
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});

describe('USE_MOCKS off (real HTTP)', () => {
  beforeEach(() => useMocks(false));
  afterEach(() => {
    jest.restoreAllMocks();
    useMocks(true);
  });

  /** A minimal fetch Response. */
  const respond = (status: number, body: unknown) =>
    ({ status, ok: status >= 200 && status < 300, text: async () => (body === undefined ? '' : JSON.stringify(body)) }) as never;

  it('adds the bearer token, JSON body and query string', async () => {
    signedInWith('abc');
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue(respond(201, { id: 'x' }));
    await expect(api('POST', '/events', { body: { title: 'T' }, query: { a: 1 } })).resolves.toEqual({ id: 'x' });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit & { headers: Record<string, string> }];
    expect(url).toBe('http://api.test:8080/events?a=1');
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('Bearer abc');
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(init.body).toBe('{"title":"T"}');
  });

  it('sends no Authorization header when signed out', async () => {
    signedInWith(null);
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue(respond(200, []));
    await api('GET', '/events');
    const init = fetchMock.mock.calls[0][1] as { headers: Record<string, string> };
    expect(init.headers.Authorization).toBeUndefined();
  });

  it('returns undefined for 204 answers', async () => {
    signedInWith('t');
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(respond(204, undefined));
    await expect(api('DELETE', '/events/1')).resolves.toBeUndefined();
  });

  it('turns the API error shape into an ApiError', async () => {
    signedInWith('t');
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(respond(409, { status: 409, code: 'EVENT_FULL', message: 'No spots', fields: null }));
    const error = await api('POST', '/events/1/join').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 409, code: 'EVENT_FULL', message: 'No spots' });
  });

  it('survives a non-JSON error body', async () => {
    signedInWith('t');
    jest.spyOn(globalThis, 'fetch').mockResolvedValue({ status: 502, ok: false, text: async () => '<html>' } as never);
    await expect(api('GET', '/events')).rejects.toMatchObject({ status: 502, code: 'INTERNAL_ERROR' });
  });

  it('reports network failures with the NETWORK code', async () => {
    signedInWith('t');
    jest.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Network request failed'));
    await expect(api('GET', '/events')).rejects.toMatchObject({ status: 0, code: 'NETWORK' });
  });
});
