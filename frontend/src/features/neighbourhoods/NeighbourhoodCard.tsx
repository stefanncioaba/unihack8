// One live area card on the Neighbourhood Pulse screen: photo header, then events, transit, places, people and help.
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { ImageBackground, Pressable, StyleSheet, View } from 'react-native';

import type { NeighbourhoodPulse } from '@/api/types.neighbourhoods';
import { openEvent } from '@/features/events/EventCards';
import { StatusChip } from '@/ui/Chip';
import { Icon, type IconName } from '@/ui/Icon';
import { Text } from '@/ui/Text';
import { colors, radius } from '@/ui/theme';

import { neighbourhoodPhoto } from './photos';
import { eventsLine, eventWhen, helpLine, LEVEL_META, peopleLine, placesLine, transitLine } from './pulseFormat';

const PHOTO_HEIGHT = 120;

/** Opens the Map tab centred on the area. */
function showOnMap(area: NeighbourhoodPulse) {
  router.push({ pathname: '/map', params: { lat: String(area.lat), lon: String(area.lon), title: area.name, at: String(Date.now()) } });
}

/** One icon + text line inside the card. */
function Row({ icon, text, tone = 'primary', testID }: { icon: IconName; text: string; tone?: 'primary' | 'muted' | 'danger'; testID?: string }) {
  return (
    <View style={styles.row} testID={testID}>
      <Icon name={icon} size={15} color={tone === 'danger' ? colors.danger : colors.signal} />
      <Text variant="body" tone={tone} style={styles.rowText} numberOfLines={2}>
        {text}
      </Text>
    </View>
  );
}

/** The photo header with the area name and its Busy / Steady / Quiet chip. */
function Header({ area }: { area: NeighbourhoodPulse }) {
  const photo = neighbourhoodPhoto(area.id);
  const level = LEVEL_META[area.level] ?? LEVEL_META.QUIET;
  const content = (
    <LinearGradient colors={['rgba(0,8,20,0.05)', 'rgba(0,8,20,0.85)']} style={styles.headerShade}>
      <View style={styles.headerRow}>
        <Text variant="heading" style={styles.name} numberOfLines={1} accessibilityRole="header">
          {area.name}
        </Text>
        <StatusChip label={level.label} tone={level.tone} />
      </View>
      {photo ? (
        <Text variant="caption" tone="muted" style={styles.credit} numberOfLines={1}>
          Photo: {photo.credit}
        </Text>
      ) : null}
    </LinearGradient>
  );
  if (!photo) return <View style={[styles.photo, styles.noPhoto]}>{content}</View>;
  return (
    <ImageBackground source={photo.source} style={styles.photo} imageStyle={styles.photoImage} accessibilityLabel={`Photo of ${area.name}`} testID={`pulse-photo-${area.id}`}>
      {content}
    </ImageBackground>
  );
}

/** Full area card; tapping it opens the area's panel (Events | Help), event rows open the event, the help line opens
 * the Help tab, "Show on map" opens the Map tab there. `helpCount` is the area's open help requests (hidden while unknown). */
export function NeighbourhoodCard({ area, helpCount }: { area: NeighbourhoodPulse; helpCount?: number }) {
  const firstAlert = area.transit.alerts[0];
  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.92 }]}
      testID={`pulse-card-${area.id}`}
      accessibilityRole="button"
      accessibilityLabel={`Open ${area.name}`}
      onPress={() => router.push(`/pulse/${area.id}`)}
    >
      <Header area={area} />
      <View style={styles.body}>
        <Row icon="calendar-outline" text={eventsLine(area)} testID={`pulse-events-${area.id}`} />
        {area.events.highlights.map((event) => (
          <Pressable
            key={event.id}
            accessibilityRole="button"
            accessibilityLabel={`Open ${event.title}`}
            onPress={() => openEvent(event.id)}
            style={({ pressed }) => [styles.event, pressed && { opacity: 0.8 }]}
          >
            {event.happeningNow ? <View style={styles.liveDot} /> : null}
            <Text variant="cardTitle" numberOfLines={1} style={styles.eventTitle}>
              {event.title}
            </Text>
            <Text variant="caption" tone={event.happeningNow ? 'accent' : 'muted'}>
              {eventWhen(event)}
            </Text>
          </Pressable>
        ))}
        <Row icon="bus-outline" text={transitLine(area)} tone={area.transit.available ? 'primary' : 'muted'} testID={`pulse-transit-${area.id}`} />
        {firstAlert ? (
          <Row
            icon="warning-outline"
            tone="danger"
            text={firstAlert.title + (area.transit.alerts.length > 1 ? ` (+${area.transit.alerts.length - 1} more)` : '')}
            testID={`pulse-alert-${area.id}`}
          />
        ) : null}
        <Row icon="storefront-outline" text={placesLine(area)} testID={`pulse-places-${area.id}`} />
        <Row icon="people-outline" text={peopleLine(area)} testID={`pulse-people-${area.id}`} />
        {helpCount !== undefined ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${helpLine(helpCount)} in ${area.name}`}
            onPress={() => router.push(`/pulse/${area.id}?tab=help`)}
            hitSlop={4}
          >
            <Row icon="hand-left-outline" text={helpLine(helpCount)} tone={helpCount > 0 ? 'primary' : 'muted'} testID={`pulse-help-${area.id}`} />
          </Pressable>
        ) : null}
        <Pressable accessibilityRole="link" accessibilityLabel={`Show ${area.name} on the map`} onPress={() => showOnMap(area)} style={styles.mapLink} hitSlop={6}>
          <Icon name="map-outline" size={14} color={colors.gold} />
          <Text variant="caption" tone="accent">
            Show on map
          </Text>
        </Pressable>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  photo: { height: PHOTO_HEIGHT, width: '100%' },
  photoImage: { resizeMode: 'cover' },
  noPhoto: { backgroundColor: colors.oxford },
  headerShade: { flex: 1, justifyContent: 'flex-end', paddingHorizontal: 14, paddingBottom: 8 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  name: { flexShrink: 1 },
  credit: { fontSize: 9, marginTop: 2, opacity: 0.8 },
  body: { padding: 14, gap: 8 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  rowText: { flex: 1 },
  event: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: 23,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: radius.field,
    backgroundColor: colors.surfaceAlt,
  },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.accent },
  eventTitle: { flex: 1 },
  mapLink: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', marginTop: 2 },
});
