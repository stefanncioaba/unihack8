// "Reliability history": the latest score changes of a user and why they happened (PLAN 16.1).
import { StyleSheet, View } from 'react-native';

import { useReliability } from '@/hooks/useUsers';
import { formatDate } from '@/lib/time';
import { Card } from '@/ui/Card';
import { EmptyState, ErrorState, LoadingState } from '@/ui/States';
import { Text } from '@/ui/Text';
import { colors } from '@/ui/theme';

import { openEvent } from '../events/EventCards';
import { formatPoints, reasonLabel } from './reliability';

/** List of the 20 most recent score changes; handles its own loading, empty and error states. */
export function ReliabilityLog({ userId }: { userId: string }) {
  const history = useReliability(userId);

  if (history.isPending) return <LoadingState label="Loading history…" />;
  if (history.isError) return <ErrorState error={history.error} onRetry={() => history.refetch()} />;
  if (history.data.entries.length === 0) {
    return <EmptyState icon="shield-checkmark-outline" title="No changes yet" message="Join an event and get checked in to see your score move." />;
  }

  return (
    <Card style={styles.card} testID="reliability-log">
      {history.data.entries.map((entry, i) => (
        <View key={`${entry.createdAt}-${i}`} style={[styles.row, i > 0 && styles.rowBorder]} testID={`reliability-entry-${i}`}>
          <View style={styles.body}>
            <Text variant="cardTitle">{reasonLabel(entry.reason)}</Text>
            <Text
              variant="caption"
              tone="muted"
              numberOfLines={1}
              onPress={entry.eventId ? () => openEvent(entry.eventId!) : undefined}
              accessibilityRole={entry.eventId ? 'link' : undefined}
            >
              {entry.eventTitle ?? 'Deleted event'} · {formatDate(entry.createdAt)}
            </Text>
          </View>
          <Text variant="heading" style={{ color: entry.pointsChange > 0 ? colors.teal : colors.danger }} accessibilityLabel={`${formatPoints(entry.pointsChange)} points`}>
            {formatPoints(entry.pointsChange)}
          </Text>
        </View>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { paddingVertical: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  rowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  body: { flex: 1, gap: 2 },
});
