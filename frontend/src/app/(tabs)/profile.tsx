// Profile tab: my identity, reliability, find people, sign out (PLAN 12.2 sign-out; full profile is task 16).
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useAuth } from '@/features/auth/AuthProvider';
import { ReliabilityGauge } from '@/features/users/ReliabilityGauge';
import { useMe } from '@/hooks/queries';
import { formatDate } from '@/lib/time';
import { Avatar } from '@/ui/Avatar';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Screen } from '@/ui/Screen';
import { ErrorState, LoadingState } from '@/ui/States';
import { Text } from '@/ui/Text';

/** The signed-in user's profile page. */
export default function ProfileScreen() {
  const me = useMe();
  const { signOut } = useAuth();
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Ends the session; the root gate then shows the sign-in screen. */
  async function handleSignOut() {
    setSigningOut(true);
    setError(null);
    try {
      await signOut();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not sign out.');
      setSigningOut(false);
    }
  }

  return (
    <Screen scroll>
      <Text variant="title" style={styles.title} accessibilityRole="header">
        Profile
      </Text>
      {me.isPending ? (
        <LoadingState label="Loading profile…" />
      ) : me.isError ? (
        <ErrorState error={me.error} onRetry={() => me.refetch()} />
      ) : (
        <View style={{ gap: 18 }}>
          <View style={styles.identity}>
            <Avatar size={52} />
            <View>
              <Text variant="title">{me.data.username}</Text>
              <Text variant="caption" tone="muted">
                Member since {formatDate(me.data.createdAt)}
              </Text>
            </View>
          </View>
          <Card>
            <ReliabilityGauge score={me.data.reliabilityScore} />
          </Card>
        </View>
      )}

      <View style={styles.actions}>
        <Button title="Find people" variant="secondary" icon="people-outline" iconLeft onPress={() => router.push('/users/search')} />
        {error ? (
          <Text tone="danger" accessibilityRole="alert">
            {error}
          </Text>
        ) : null}
        <Button title="Sign out" variant="danger" icon="log-out-outline" iconLeft loading={signingOut} onPress={handleSignOut} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { paddingTop: 10, paddingBottom: 14 },
  identity: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  actions: { gap: 12, marginTop: 28 },
});
