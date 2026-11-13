// The app never falls back to mock data (PLAN 17.1): without a backend address every call fails clearly.
jest.unmock('@/api/client');
jest.mock('@/config', () => ({ API_URL: '', SUPABASE_URL: '', SUPABASE_KEY: '' }));

import { api } from '@/api/client';
import { friendlyError } from '@/api/errors';

describe('API client without EXPO_PUBLIC_API_URL', () => {
  it('fails with NOT_CONFIGURED and never calls fetch or mocks', async () => {
    const fetchSpy = jest.spyOn(globalThis, 'fetch');
    const error = await api('GET', '/events').catch((e: unknown) => e);
    expect(error).toMatchObject({ status: 0, code: 'NOT_CONFIGURED' });
    expect(friendlyError(error)).toContain('EXPO_PUBLIC_API_URL');
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
