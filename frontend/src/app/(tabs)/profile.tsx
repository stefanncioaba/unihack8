// Profile tab: my identity (with change username), reliability score and history, my events, find people, sign out.
// PLAN 12.2 sign-out; 16.1 score explanation and history; 16.2 change username; 16.3 my events.
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useAuth } from '@/features/auth/AuthProvider';
import { MyEvents } from '@/features/users/MyEvents';
import { ReliabilityGauge } from '@/features/users/ReliabilityGauge';
import { ReliabilityLog } from '@/features/users/ReliabilityLog';
import { UsernameEditor } from '@/features/users/UsernameEditor';
import { useMe } from '@/hooks/queries';
import { formatDate } from '@/lib/time';
import { Avatar } from '@/ui/Avatar';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Icon } from '@/ui/Icon';
import { Screen } from '@/ui/Screen';
import { ErrorState, LoadingState } from '@/ui/States';
import { Text } from '@/ui/Text';
import { colors } from '@/ui/theme';

/** The signed-in user's profile page. */
export default function ProfileScreen() {
  const me = useMe();
  const { signOut } = useAuth();
  const [signingOut, setSigningOut] = useState(false);
  const [editing, setEditing] = useState(false);
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
          {editing ? (
            <Card>
              <UsernameEditor current={me.data.username} onDone={() => setEditing(false)} />
            </Card>
          ) : (
            <View style={styles.identity}>
              <Avatar size={52} />
              <View style={{ flex: 1 }}>
                <Text variant="title">{me.data.username}</Text>
                <Text variant="caption" tone="muted">
                  Member since {formatDate(me.data.createdAt)}
                </Text>
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel="Change username" onPress={() => setEditing(true)} hitSlop={10} style={styles.edit}>
                <Icon name="create-outline" size={18} color={colors.orangeSoft} />
              </Pressable>
            </View>
          )}
          <Card>
            <ReliabilityGauge score={me.data.reliabilityScore} />
          </Card>

          <Text variant="heading" accessibilityRole="header">
            My events
          </Text>
          <MyEvents />

          <Text variant="heading" accessibilityRole="header">
            Reliability history
          </Text>
          <ReliabilityLog userId={me.data.id} />
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
  edit: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  actions: { gap: 12, marginTop: 28 },
});
