// Event cards: a large one for horizontal rows (Home) and a compact row for lists.
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import type { EventSummary } from '@/api/types';
import { formatEventDate, monthDay } from '@/lib/time';
import { Icon } from '@/ui/Icon';
import { StatusChip } from '@/ui/Chip';
import { Text } from '@/ui/Text';
import { colors, radius } from '@/ui/theme';

import { categoryMeta } from './categories';
import { EventArt } from './EventArt';
import { availabilityLabel, isFull } from './format';
import { compactRating, ratingSummary } from './reviews';

/** Opens the event details screen. */
export function openEvent(id: string) {
  router.push(`/events/${id}`);
}

/** Chip showing spots left (USER events) or the ticket price (EXTERNAL events). */
function AvailabilityChip({ event }: { event: EventSummary }) {
  const label = availabilityLabel(event);
  if (!label) return null;
  return <StatusChip label={label} tone={isFull(event) ? 'danger' : event.source === 'EXTERNAL' ? 'muted' : 'signal'} />;
}

/** Small "★ 4.3 (12)" line; nothing when the event has no reviews. */
export function RatingPill({ event }: { event: EventSummary }) {
  const label = compactRating(event);
  if (!label) return null;
  return (
    <View style={styles.rating} accessible accessibilityLabel={`Rated ${ratingSummary(event.averageRating, event.reviewCount)}`} testID={`event-rating-${event.id}`}>
      <Icon name="star" size={11} color={colors.accent} />
      <Text variant="caption" tone="accent">
        {label}
      </Text>
    </View>
  );
}

/** Small calendar page (yellow month strip over the day number) for the corner of event art. */
export function DateBadge({ iso }: { iso: string }) {
  const { month, day } = monthDay(iso);
  return (
    <View style={styles.badge} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Text style={styles.badgeMonth}>{month}</Text>
      <Text style={styles.badgeDay}>{day}</Text>
    </View>
  );
}

/** Large card (16:9 art, two-line title, warm date line) for horizontally scrolling rows. */
export function EventCard({ event, width = 264 }: { event: EventSummary; width?: number }) {
  const meta = categoryMeta(event.category);
  return (
    <Pressable
      testID={`event-card-${event.id}`}
      accessibilityRole="button"
      accessibilityLabel={`${event.title}, ${formatEventDate(event.startsAt)}`}
      onPress={() => openEvent(event.id)}
      style={({ pressed }) => [styles.card, { width }, pressed && { opacity: 0.85 }]}
    >
      <EventArt category={event.category} imageUrl={event.imageUrl} shade>
        <View style={styles.corner}>
          <DateBadge iso={event.startsAt} />
        </View>
        <View style={styles.categoryIcon}>
          <Icon name={meta.icon} size={14} color={colors.text} />
        </View>
        <View style={styles.overlay}>
          <Text variant="cardTitle" numberOfLines={2}>
            {event.title}
          </Text>
          <Text variant="caption" tone="accent" numberOfLines={1}>
            {formatEventDate(event.startsAt)}
          </Text>
        </View>
      </EventArt>
      <View style={styles.footer}>
        <View style={styles.place}>
          <Icon name="location-outline" size={13} color={colors.textMuted} />
          <Text variant="caption" tone="muted" numberOfLines={1} style={{ flexShrink: 1 }}>
            {event.venueName ?? 'Timișoara'}
          </Text>
        </View>
        <RatingPill event={event} />
        <AvailabilityChip event={event} />
      </View>
    </Pressable>
  );
}

/** Compact list row with a square thumbnail. */
export function EventListItem({ event }: { event: EventSummary }) {
  return (
    <Pressable
      testID={`event-row-${event.id}`}
      accessibilityRole="button"
      accessibilityLabel={`${event.title}, ${formatEventDate(event.startsAt)}`}
      onPress={() => openEvent(event.id)}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.85 }]}
    >
      <EventArt category={event.category} imageUrl={event.imageUrl} aspectRatio={1} iconSize={26} style={styles.thumb} />
      <View style={styles.rowBody}>
        <Text variant="cardTitle" numberOfLines={2}>
          {event.title}
        </Text>
        <Text variant="caption" tone="accent" numberOfLines={1}>
          {formatEventDate(event.startsAt)}
        </Text>
        <Text variant="caption" tone="muted" numberOfLines={1}>
          {event.venueName ?? 'Timișoara'}
        </Text>
        <RatingPill event={event} />
      </View>
      <AvailabilityChip event={event} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.card,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  corner: { position: 'absolute', top: 10, left: 10 },
  badge: { width: 42, borderRadius: 9, overflow: 'hidden', backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.borderStrong, alignItems: 'center' },
  badgeMonth: { alignSelf: 'stretch', textAlign: 'center', fontSize: 9.5, lineHeight: 14, fontWeight: '800', color: colors.onAccent, backgroundColor: colors.accent },
  badgeDay: { fontSize: 16, lineHeight: 21, fontWeight: '800', color: colors.text, fontVariant: ['tabular-nums'] },
  categoryIcon: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,8,20,0.6)',
  },
  overlay: { position: 'absolute', left: 12, right: 12, bottom: 10, gap: 2 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: 10 },
  place: { flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 10,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  thumb: { width: 64, borderRadius: 10 },
  rowBody: { flex: 1, gap: 2 },
  rating: { flexDirection: 'row', alignItems: 'center', gap: 3 },
});
