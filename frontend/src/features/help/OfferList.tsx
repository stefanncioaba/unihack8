// People who offered to help, with their civic trust score and skills (PLAN 28: the ones that fit the request are
// highlighted), so the requester can choose whom to trust (PLAN 25).
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import type { HelpCategory, HelpOffer } from '@/api/types.help';
import { SkillChips } from '@/features/users/SkillChips';
import { skillsFor } from '@/features/users/skills';
import { Avatar } from '@/ui/Avatar';
import { StatusChip } from '@/ui/Chip';
import { ReliabilityBadge } from '@/ui/ReliabilityBadge';
import { Text } from '@/ui/Text';
import { colors, radius } from '@/ui/theme';

import { timeAgo } from './format';

/** Chip for a scanned helper or a helper who was not needed. */
function offerChip(offer: HelpOffer) {
  if (offer.status === 'HELPED') return <StatusChip label="Helped" tone="signal" />;
  if (offer.status === 'NOT_NEEDED') return <StatusChip label="Not needed" tone="muted" />;
  return null;
}

/** Vertical list of offers; tapping a row opens that person's profile. `category` is the request's, for highlighting. */
export function OfferList({ offers, category, now = Date.now() }: { offers: HelpOffer[]; category?: HelpCategory; now?: number }) {
  return (
    <View style={styles.list} testID="offer-list">
      {offers.map((o) => (
        <Pressable
          key={o.user.id}
          testID={`offer-${o.user.username}`}
          accessibilityRole="button"
          accessibilityLabel={`Open profile of ${o.user.username}`}
          onPress={() => router.push(`/users/${o.user.id}`)}
          style={styles.row}
        >
          <Avatar size={36} />
          <View style={{ flex: 1, gap: 3 }}>
            <Text variant="cardTitle" numberOfLines={1}>
              {o.user.username}
            </Text>
            <Text variant="caption" tone="muted">
              Offered {timeAgo(o.offeredAt, now).toLowerCase()}
              {category && skillsFor(o.skills, category).length > 0 ? ' · Has a matching skill' : ''}
            </Text>
            <SkillChips skills={o.skills} highlight={category} testID={`offer-skills-${o.user.username}`} />
          </View>
          <View style={styles.badges}>
            {offerChip(o)}
            <ReliabilityBadge score={o.user.reliabilityScore} />
          </View>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 10,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  badges: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
