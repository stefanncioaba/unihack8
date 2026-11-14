// One help request as a list row: category icon, title, requester with civic trust, offers, age and expiry (PLAN 25).
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import type { HelpRequestSummary } from '@/api/types.help';
import { StatusChip } from '@/ui/Chip';
import { Icon } from '@/ui/Icon';
import { ReliabilityBadge } from '@/ui/ReliabilityBadge';
import { Text } from '@/ui/Text';
import { colors, radius } from '@/ui/theme';

import { helpCategoryMeta } from './categories';
import { expiresIn, myOfferLabel, offersLabel, statusLabel, timeAgo } from './format';

/** Opens a help request's page. */
export function openHelpRequest(id: string) {
  router.push(`/help/${id}`);
}

/** Chip for a closed request, or for my own offer on an open one. */
function StateChip({ request }: { request: HelpRequestSummary }) {
  if (request.status !== 'OPEN') {
    return <StatusChip label={statusLabel(request)} tone={request.status === 'HELPED' ? 'signal' : 'muted'} />;
  }
  const mine = myOfferLabel(request.myOffer);
  return mine ? <StatusChip label={mine} tone="signal" /> : null;
}

/** Tappable row; `showRequester` is off in "You asked", where the requester is me. */
export function HelpRequestRow({ request, showRequester = true, now = Date.now() }: { request: HelpRequestSummary; showRequester?: boolean; now?: number }) {
  const meta = helpCategoryMeta(request.category);
  const timing = request.status === 'OPEN' ? `${timeAgo(request.createdAt, now)} · ${expiresIn(request.expiresAt, now)}` : timeAgo(request.createdAt, now);
  return (
    <Pressable
      testID={`help-card-${request.id}`}
      accessibilityRole="button"
      accessibilityLabel={`${request.title}, ${meta.label}`}
      onPress={() => openHelpRequest(request.id)}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.85 }]}
    >
      <View style={styles.icon}>
        <Icon name={meta.icon} size={20} color={colors.signal} />
      </View>
      <View style={styles.body}>
        <Text variant="cardTitle" numberOfLines={2}>
          {request.title}
        </Text>
        {showRequester && (
          <View style={styles.who}>
            <Text variant="caption" tone="muted" numberOfLines={1} style={{ flexShrink: 1 }}>
              {request.requester.username}
            </Text>
            <ReliabilityBadge score={request.requester.reliabilityScore} />
          </View>
        )}
        <Text variant="caption" tone="muted" numberOfLines={1}>
          {offersLabel(request.offerCount)} · {timing}
        </Text>
        {request.address ? (
          <Text variant="caption" tone="muted" numberOfLines={1}>
            {request.address}
          </Text>
        ) : null}
      </View>
      <StateChip request={request} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  icon: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(142,197,255,0.10)' },
  body: { flex: 1, gap: 3 },
  who: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
