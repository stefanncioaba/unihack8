// Sign-up screen: e-mail, password and username (PLAN 12.2).
import { Link } from 'expo-router';
import { useState } from 'react';

import { AuthShell } from '@/features/auth/AuthShell';
import { useAuth } from '@/features/auth/AuthProvider';
import { validateEmail, validatePassword, validateUsername } from '@/lib/validation';
import { Button } from '@/ui/Button';
import { Text } from '@/ui/Text';
import { TextField } from '@/ui/TextField';

/** Creates the account. The username is checked against the backend first. */
export default function SignUpScreen() {
  const { signUp } = useAuth();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ username?: string; email?: string; password?: string; form?: string }>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  /** Validates every field, then creates the account. */
  async function submit() {
    const next = {
      username: validateUsername(username) ?? undefined,
      email: validateEmail(email) ?? undefined,
      password: validatePassword(password) ?? undefined,
    };
    setErrors(next);
    setNotice(null);
    if (next.username || next.email || next.password) return;
    setBusy(true);
    try {
      const result = await signUp({ email, password, username });
      if (result.needsConfirmation) setNotice('Check your inbox and confirm your e-mail, then sign in.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not create the account.';
      // Username problems belong under the username field.
      if (/username/i.test(message)) setErrors({ username: message });
      else setErrors({ form: message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title="Create your account"
      subtitle="Join events, build your civic trust score and meet people nearby."
      footer={
        <>
          <Text tone="muted">Already have an account?</Text>
          <Link href="/sign-in" accessibilityRole="link">
            <Text tone="accent" style={{ fontWeight: '600' }}>
              Sign in
            </Text>
          </Link>
        </>
      }
    >
      <TextField
        label="Username"
        value={username}
        onChangeText={setUsername}
        error={errors.username}
        autoCapitalize="none"
        autoCorrect={false}
        maxLength={20}
        placeholder="3–20 letters, digits or _"
      />
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
        autoComplete="new-password"
        placeholder="At least 6 characters"
        onSubmitEditing={submit}
      />
      {errors.form ? (
        <Text tone="danger" accessibilityRole="alert">
          {errors.form}
        </Text>
      ) : null}
      {notice ? <Text tone="signal">{notice}</Text> : null}
      <Button title="Create account" icon="arrow-forward" onPress={submit} loading={busy} />
    </AuthShell>
  );
}
