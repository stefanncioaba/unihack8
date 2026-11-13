// Sign-in screen (PLAN 12.2).
import { Link } from 'expo-router';
import { useState } from 'react';

import { AuthShell } from '@/features/auth/AuthShell';
import { useAuth } from '@/features/auth/AuthProvider';
import { validateEmail } from '@/lib/validation';
import { Button } from '@/ui/Button';
import { Text } from '@/ui/Text';
import { TextField } from '@/ui/TextField';

/** E-mail + password sign-in. On success the root gate swaps to the tabs. */
export default function SignInScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string; form?: string }>({});
  const [busy, setBusy] = useState(false);

  /** Validates, then signs in; shows the server's message when it fails. */
  async function submit() {
    const next = {
      email: validateEmail(email) ?? undefined,
      password: password ? undefined : 'Enter your password.',
    };
    setErrors(next);
    if (next.email || next.password) return;
    setBusy(true);
    try {
      await signIn(email, password);
    } catch (error) {
      setErrors({ form: error instanceof Error ? error.message : 'Could not sign in.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to see what is happening around you."
      footer={
        <>
          <Text tone="muted">New here?</Text>
          <Link href="/sign-up" accessibilityRole="link">
            <Text tone="accent" style={{ fontWeight: '600' }}>
              Create an account
            </Text>
          </Link>
        </>
      }
    >
      <TextField
        label="E-mail"
        value={email}
        onChangeText={setEmail}
        error={errors.email}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        placeholder="you@example.com"
      />
      <TextField
        label="Password"
        value={password}
        onChangeText={setPassword}
        error={errors.password}
        secureTextEntry
        autoCapitalize="none"
        autoComplete="current-password"
        placeholder="Your password"
        onSubmitEditing={submit}
      />
      {errors.form ? (
        <Text tone="danger" accessibilityRole="alert">
          {errors.form}
        </Text>
      ) : null}
      <Button title="Sign in" icon="arrow-forward" onPress={submit} loading={busy} />
    </AuthShell>
  );
}
