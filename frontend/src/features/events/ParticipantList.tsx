// Participants of an event with reliability scores. Tapping a row opens the profile; organisers get a Ban button.
import { router } from 'expo-router';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import type { Participant, ParticipantStatus } from '@/api/types';
import { StatusChip } from '@/ui/Chip';
import { Avatar } from '@/ui/Avatar';
import { Button } from '@/ui/Button';
import { ReliabilityBadge } from '@/ui/ReliabilityBadge';
import { Text } from '@/ui/Text';
import { colors, radius } from '@/ui/theme';

type Props = {
  participants: Participant[];
  /** Show a ban button on active participants (organiser only). */
  canBan?: boolean;
  banning?: boolean;
  onBan?: (userId: string) => void;
};

/** Status chip for non-default statuses. */
function statusChip(status: ParticipantStatus) {
  if (status === 'ATTENDED') return <StatusChip label="Checked in" tone="teal" />;
  if (status === 'NO_SHOW') return <StatusChip label="No-show" tone="danger" />;
  if (status === 'BANNED') return <StatusChip label="Banned" tone="danger" />;
  return null;
}

/** Asks the organiser to confirm before banning. */
function confirmBan(username: string, onConfirm: () => void) {
  Alert.alert(`Ban ${username}?`, 'They will lose their spot and cannot join this event again.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Ban', style: 'destructive', onPress: onConfirm },
  ]);
}

/** Vertical list of participant rows. */
export function ParticipantList({ participants, canBan, banning, onBan }: Props) {
  return (
    <View style={styles.list} testID="participant-list">
      {participants.map((p) => (
        <View key={p.user.id} style={styles.row} testID={`participant-${p.user.username}`}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Open profile of ${p.user.username}`}
            onPress={() => router.push(`/users/${p.user.id}`)}
            style={styles.who}
          >
            <Avatar size={36} />
            <View style={{ flex: 1, gap: 3 }}>
              <Text variant="cardTitle" numberOfLines={1}>
                {p.user.username}
              </Text>
              <View style={styles.badges}>
                <ReliabilityBadge score={p.user.reliabilityScore} />
                {statusChip(p.status)}
              </View>
            </View>
          </Pressable>
          {canBan && (p.status === 'JOINED' || p.status === 'ATTENDED') && (
            <Button
              title="Ban"
              variant="danger"
              small
              disabled={banning}
              onPress={() => confirmBan(p.user.username, () => onBan?.(p.user.id))}
            />
          )}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  who: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  badges: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
