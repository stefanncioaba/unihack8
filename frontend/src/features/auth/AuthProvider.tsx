// Supabase sign-up / sign-in / sign-out with the session kept on the device (PLAN 12.2).
import type { Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { checkUsername } from '@/api/endpoints';
import { ApiError } from '@/api/errors';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

export type SignUpInput = { email: string; password: string; username: string };

export type AuthState = {
  session: Session | null;
  /** True until the stored session has been read from the device. */
  loading: boolean;
  /** False when `.env` has no Supabase keys. */
  configured: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  /** Resolves `needsConfirmation: true` when the project still requires e-mail confirmation. */
  signUp: (input: SignUpInput) => Promise<{ needsConfirmation: boolean }>;
  signOut: () => Promise<void>;
};

export const AuthContext = createContext<AuthState | null>(null);

/** Holds the Supabase session for the whole app. Mount once, near the root. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    supabase.auth
      .getSession()
      .then(({ data }) => active && setSession(data.session))
      .catch(() => active && setSession(null))
      .finally(() => active && setLoading(false));
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));

    // Token refresh only needs to run while the app is in the foreground.
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') supabase.auth.startAutoRefresh();
      else supabase.auth.stopAutoRefresh();
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
      appState.remove();
    };
  }, []);

  /** Signs in with e-mail and password; throws the Supabase error message on failure. */
  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) throw new Error(error.message);
  }, []);

  /** Checks the username first (the database trigger would silently replace a taken one), then creates the account. */
  const signUp = useCallback(async ({ email, password, username }: SignUpInput) => {
    try {
      const result = await checkUsername(username);
      if (!result.available) throw new ApiError(409, 'USERNAME_TAKEN', 'That username is already taken.');
    } catch (error) {
      if (error instanceof ApiError && error.code !== 'NETWORK' && error.code !== 'TIMEOUT') throw error;
      throw new Error('Could not check the username. Make sure the backend is reachable and try again.');
    }
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { username } },
    });
    if (error) throw new Error(error.message);
    return { needsConfirmation: !data.session };
  }, []);

  /** Ends the session; the root layout then shows only the auth screens. */
  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw new Error(error.message);
  }, []);

  const value = useMemo<AuthState>(
    () => ({ session, loading, configured: isSupabaseConfigured, signIn, signUp, signOut }),
    [session, loading, signIn, signUp, signOut],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** Access the auth state. Must be used inside AuthProvider. */
export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
