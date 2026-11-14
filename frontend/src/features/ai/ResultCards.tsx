// Place and event cards under an assistant answer, with "Show on map" and "Open event" (PLAN 15.4).
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import type { EventSummary } from '@/api/types';
import type { PlaceSummary } from '@/api/types.places';
import { EventListItem } from '@/features/events/EventCards';
import { placeMeta } from '@/features/map/placeCategories';
import type { UiMessage } from '@/hooks/useAi';
import { formatDistance } from '@/lib/format';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Icon } from '@/ui/Icon';
import { Text } from '@/ui/Text';
import { colors } from '@/ui/theme';

/** Opens the Map tab on this spot and opens its panel there. */
function showOnMap(target: { lat: number; lon: number; title: string } & ({ placeId: string } | { eventId: string })) {
  router.push({
    pathname: '/map',
    params: { lat: String(target.lat), lon: String(target.lon), title: target.title, ...('placeId' in target ? { placeId: target.placeId } : { eventId: target.eventId }), at: String(Date.now()) },
  });
}

/** One place the assistant mentioned. */
function PlaceResult({ place }: { place: PlaceSummary }) {
  const meta = placeMeta(place.category);
  return (
    <Card style={styles.card} testID={`result-place-${place.id}`}>
      <View style={styles.head}>
        <View style={styles.badge}>
          <Icon name={meta.icon} size={15} color="#fff" />
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="cardTitle" numberOfLines={1}>
            {place.name}
          </Text>
          <Text variant="caption" tone="muted" numberOfLines={1}>
            {[meta.label, place.distanceMeters !== null ? formatDistance(place.distanceMeters) : null, place.address].filter(Boolean).join(' · ')}
          </Text>
        </View>
      </View>
      <Button
        title="Show on map"
        icon="map-outline"
        iconLeft
        small
        variant="secondary"
        onPress={() => showOnMap({ lat: place.lat, lon: place.lon, title: place.name, placeId: place.id })}
      />
    </Card>
  );
}

/** One event the assistant mentioned: the usual event card plus a map shortcut. */
function EventResult({ event }: { event: EventSummary }) {
  return (
    <View style={{ gap: 6 }} testID={`result-event-${event.id}`}>
      <EventListItem event={event} />
      {event.lat !== null && event.lon !== null ? (
        <Button
          title="Show on map"
          icon="map-outline"
          iconLeft
          small
          variant="secondary"
          onPress={() => showOnMap({ lat: event.lat as number, lon: event.lon as number, title: event.title, eventId: event.id })}
        />
      ) : null}
    </View>
  );
}

/** All cards for one assistant message (nothing when it mentioned no place or event). */
export function ResultCards({ message }: { message: UiMessage }) {
  const places = message.places ?? [];
  const events = message.events ?? [];
  if (places.length === 0 && events.length === 0) return null;
  return (
    <View style={styles.list} testID="result-cards">
      {places.map((p) => (
        <PlaceResult key={p.id} place={p} />
      ))}
      {events.map((e) => (
        <EventResult key={e.id} event={e} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { alignSelf: 'stretch', gap: 8 },
  card: { gap: 10, padding: 12 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  badge: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.oxford },
});
