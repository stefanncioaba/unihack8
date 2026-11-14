// Helpers shared by the screen tests.
import { QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react-native';
import { router } from 'expo-router';
import type { ReactElement } from 'react';

import { AuthContext, type AuthState } from '@/features/auth/AuthProvider';
import { createQueryClient } from '@/lib/queryClient';

/** The mocked expo-router `router` with jest.fn methods. */
export const mockRouter = router as unknown as { push: jest.Mock; replace: jest.Mock; back: jest.Mock };

/** Sets the route params the next render of `useLocalSearchParams` returns. */
export function setParams(params: Record<string, string>): void {
  (globalThis as { __routeParams?: Record<string, string> }).__routeParams = params;
}

/** A signed-in auth state whose methods are jest.fn, overridable per test. */
export function fakeAuth(overrides: Partial<AuthState> = {}): AuthState {
  return {
    session: { access_token: 'token' } as AuthState['session'],
    loading: false,
    configured: true,
    signIn: jest.fn(async () => {}),
    signUp: jest.fn(async () => ({ needsConfirmation: false })),
    signOut: jest.fn(async () => {}),
    ...overrides,
  };
}

/** Renders a screen inside a fresh query client and the given auth state. */
export function renderScreen(ui: ReactElement, auth: AuthState = fakeAuth()) {
  const client = createQueryClient();
  // gcTime Infinity: no 5-minute cleanup timers, so Jest can exit.
  client.setDefaultOptions({ queries: { retry: false, staleTime: 30_000, gcTime: Infinity }, mutations: { gcTime: Infinity } });
  const result = render(
    <QueryClientProvider client={client}>
      <AuthContext.Provider value={auth}>{ui}</AuthContext.Provider>
    </QueryClientProvider>,
  );
  return { ...result, client, auth };
}

/** Fixed ids from the mock data, for readable tests. */
export const IDS = {
  boardGames: 'e0000000-0000-4000-8000-000000000001', // organised by stefan, 4 spots left
  sunsetRun: 'e0000000-0000-4000-8000-000000000002', // organised by the mock user
  picnic: 'e0000000-0000-4000-8000-000000000003', // full
  indieRock: 'e0000000-0000-4000-8000-000000000004', // external
  artWalk: 'e0000000-0000-4000-8000-000000000007', // the mock user already joined
  photoWalk: 'e0000000-0000-4000-8000-000000000101', // over 10 days ago, the mock user attended (reviews closed)
  coffeeCupping: 'e0000000-0000-4000-8000-000000000104', // ended hours ago, the mock user attended: reviews open
  sushiWorkshop: 'e0000000-0000-4000-8000-000000000105', // organised by the mock user, over and settled, 2 reviews
  stella: '33333333-3333-4333-8333-333333333333',
  andrei: '44444444-4444-4444-8444-444444444444',
};
