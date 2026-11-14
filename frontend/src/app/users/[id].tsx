// Public profile of another user: username, reliability score, attended events and past events they organised (PLAN 16.4, opened from 13.4 and 13.8).
import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { EventListItem } from '@/features/events/EventCards';
import { ReliabilityLine } from '@/features/users/ReliabilityLine';
import { useUser } from '@/hooks/queries';
import { formatDate } from '@/lib/time';
import { Avatar } from '@/ui/Avatar';
import { Screen } from '@/ui/Screen';
import { ScreenHeader } from '@/ui/ScreenHeader';
import { EmptyState, ErrorState, LoadingState } from '@/ui/States';
import { Text } from '@/ui/Text';

/** Read-only profile page. */
export default function PublicProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = useUser(id);

  return (
    <Screen scroll edges={['top', 'bottom']}>
      <ScreenHeader title="Profile" />
      {user.isPending ? (
        <LoadingState label="Loading profile…" />
      ) : user.isError ? (
        <ErrorState error={user.error} onRetry={() => user.refetch()} />
      ) : (
        <View style={{ gap: 18 }}>
          <View style={styles.identity}>
            <Avatar size={52} />
            <View>
              <Text variant="title" accessibilityRole="header">
                {user.data.username}
              </Text>
              <Text variant="caption" tone="muted">
                Member since {formatDate(user.data.createdAt)}
              </Text>
            </View>
          </View>

          <ReliabilityLine score={user.data.reliabilityScore} />

          <Text variant="heading" accessibilityRole="header">
            Events attended
          </Text>
          {user.data.attendedEvents.length === 0 ? (
            <EmptyState icon="calendar-outline" title="No events yet" message={`${user.data.username} has not been checked in at an event yet.`} />
          ) : (
            <View style={{ gap: 10 }} testID="attended-events">
              {user.data.attendedEvents.map((e) => (
                <EventListItem key={e.id} event={e} />
              ))}
            </View>
          )}

          {(user.data.organizedEvents ?? []).length > 0 && (
            <>
              <Text variant="heading" accessibilityRole="header">
                Events organised
              </Text>
              <View style={{ gap: 10 }} testID="organized-events">
                {user.data.organizedEvents.map((e) => (
                  <EventListItem key={e.id} event={e} />
                ))}
              </View>
            </>
          )}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  identity: { flexDirection: 'row', alignItems: 'center', gap: 14 },
});
