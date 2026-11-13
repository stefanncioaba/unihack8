// Event cards: a large one for horizontal rows (Home) and a compact row for lists.
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import type { EventSummary } from '@/api/types';
import { formatEventDate } from '@/lib/time';
import { Icon } from '@/ui/Icon';
import { StatusChip } from '@/ui/Chip';
import { Text } from '@/ui/Text';
import { colors, radius } from '@/ui/theme';

import { categoryMeta } from './categories';
import { EventArt } from './EventArt';
import { availabilityLabel, isFull } from './format';

/** Opens the event details screen. */
export function openEvent(id: string) {
  router.push(`/events/${id}`);
}

/** Chip showing spots left (USER events) or the ticket price (EXTERNAL events). */
function AvailabilityChip({ event }: { event: EventSummary }) {
  const label = availabilityLabel(event);
  if (!label) return null;
  return <StatusChip label={label} tone={isFull(event) ? 'danger' : event.source === 'EXTERNAL' ? 'muted' : 'teal'} />;
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
  corner: {
    position: 'absolute',
    top: 10,
    left: 10,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(9,10,24,0.6)',
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
});
