// AuthProvider: stored session, sign-in, sign-up (username check first), sign-out.
import { act, render, screen, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';

import { AuthProvider, useAuth, type AuthState } from '@/features/auth/AuthProvider';
import { supabase } from '@/lib/supabase';
import * as mocks from '@/mocks';
import { ApiError } from '@/api/errors';

const auth = supabase.auth as unknown as Record<string, jest.Mock>;

/** Renders the provider and exposes the context value to the test. */
function setup() {
  const box: { current: AuthState | null } = { current: null };
  /** Copies the context into `box` and prints the state. */
  function Probe() {
    const value = useAuth();
    box.current = value;
    return <Text>{value.loading ? 'loading' : value.session ? 'signed-in' : 'signed-out'}</Text>;
  }
  render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  );
  return box;
}

describe('AuthProvider', () => {
  afterEach(() => jest.restoreAllMocks());

  beforeEach(() => {
    auth.getSession.mockResolvedValue({ data: { session: null } });
    auth.signInWithPassword.mockResolvedValue({ error: null });
    auth.signUp.mockResolvedValue({ data: { session: {} }, error: null });
    auth.signOut.mockResolvedValue({ error: null });
  });

  it('is loading, then signed out when no session is stored', async () => {
    setup();
    expect(screen.getByText('loading')).toBeTruthy();
    expect(await screen.findByText('signed-out')).toBeTruthy();
  });

  it('restores a stored session', async () => {
    auth.getSession.mockResolvedValue({ data: { session: { access_token: 't' } } });
    setup();
    expect(await screen.findByText('signed-in')).toBeTruthy();
  });

  it('follows auth state changes', async () => {
    let listener: (event: string, session: unknown) => void = () => {};
    auth.onAuthStateChange.mockImplementation((cb: typeof listener) => {
      listener = cb;
      return { data: { subscription: { unsubscribe: jest.fn() } } };
    });
    setup();
    await screen.findByText('signed-out');
    act(() => listener('SIGNED_IN', { access_token: 'x' }));
    expect(await screen.findByText('signed-in')).toBeTruthy();
    act(() => listener('SIGNED_OUT', null));
    expect(await screen.findByText('signed-out')).toBeTruthy();
  });

  it('signs in with a trimmed e-mail and surfaces Supabase errors', async () => {
    const box = setup();
    await screen.findByText('signed-out');
    await act(() => box.current!.signIn(' me@example.com ', 'pw'));
    expect(auth.signInWithPassword).toHaveBeenCalledWith({ email: 'me@example.com', password: 'pw' });

    auth.signInWithPassword.mockResolvedValue({ error: { message: 'Invalid login credentials' } });
    await expect(box.current!.signIn('me@example.com', 'bad')).rejects.toThrow('Invalid login credentials');
  });

  it('checks the username before creating the account and sends it as metadata', async () => {
    const box = setup();
    await screen.findByText('signed-out');
    await expect(box.current!.signUp({ email: 'a@b.ro', password: 'secret1', username: 'free_name' })).resolves.toEqual({ needsConfirmation: false });
    expect(auth.signUp).toHaveBeenCalledWith({ email: 'a@b.ro', password: 'secret1', options: { data: { username: 'free_name' } } });
  });

  it('refuses a taken username without calling Supabase', async () => {
    const box = setup();
    await screen.findByText('signed-out');
    await expect(box.current!.signUp({ email: 'a@b.ro', password: 'secret1', username: 'stefan' })).rejects.toThrow('already taken');
    expect(auth.signUp).not.toHaveBeenCalled();
  });

  it('reports when the username cannot be checked (backend unreachable)', async () => {
    const spy = jest.spyOn(mocks, 'mockRequest').mockRejectedValue(new ApiError(0, 'NETWORK', 'down'));
    const box = setup();
    await screen.findByText('signed-out');
    await expect(box.current!.signUp({ email: 'a@b.ro', password: 'secret1', username: 'free_name' })).rejects.toThrow('Could not check the username');
    expect(auth.signUp).not.toHaveBeenCalled();
    expect(spy).toHaveBeenCalled();
  });

  it('flags e-mail confirmation when Supabase returns no session', async () => {
    auth.signUp.mockResolvedValue({ data: { session: null }, error: null });
    const box = setup();
    await screen.findByText('signed-out');
    await expect(box.current!.signUp({ email: 'a@b.ro', password: 'secret1', username: 'free_name' })).resolves.toEqual({ needsConfirmation: true });
  });

  it('signs out', async () => {
    const box = setup();
    await screen.findByText('signed-out');
    await act(() => box.current!.signOut());
    expect(auth.signOut).toHaveBeenCalled();
    auth.signOut.mockResolvedValue({ error: { message: 'nope' } });
    await waitFor(() => expect(box.current!.signOut()).rejects.toThrow('nope'));
  });
});
