// Reviews of an event: reviewer (tap opens the profile), stars, comment and date.
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import type { Review } from '@/api/types';
import { formatDate } from '@/lib/time';
import { Avatar } from '@/ui/Avatar';
import { Text } from '@/ui/Text';
import { colors, radius } from '@/ui/theme';

import { StarRating } from './StarRating';

/** Vertical list of review cards, newest first (the API already sorts them). */
export function ReviewList({ reviews }: { reviews: Review[] }) {
  return (
    <View style={styles.list} testID="review-list">
      {reviews.map((r) => (
        <View key={r.reviewer.id} style={styles.card} testID={`review-${r.reviewer.username}`}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Review by ${r.reviewer.username}`}
            onPress={() => router.push(`/users/${r.reviewer.id}`)}
            style={styles.head}
          >
            <Avatar size={30} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="cardTitle" numberOfLines={1}>
                {r.reviewer.username}
              </Text>
              <Text variant="caption" tone="muted">
                {formatDate(r.updatedAt)}
              </Text>
            </View>
            <StarRating value={r.rating} size={13} />
          </Pressable>
          {r.comment ? <Text tone="muted">{r.comment}</Text> : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 10 },
  card: {
    gap: 8,
    padding: 12,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
});
