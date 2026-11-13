// Bottom panel for a tapped place: name, address, opening hours, a few OSM tags and "Directions" (PLAN 14.2).
import { StyleSheet, View } from 'react-native';

import { usePlace } from '@/hooks/usePlaces';
import { Button } from '@/ui/Button';
import { StatusChip } from '@/ui/Chip';
import { Icon, type IconName } from '@/ui/Icon';
import { ErrorState, LoadingState } from '@/ui/States';
import { Text } from '@/ui/Text';
import { colors } from '@/ui/theme';

import { useMapContext } from './MapContext';
import { placeMeta } from './placeCategories';

/** Tags worth showing, in order, with a readable label. */
const TAG_LABELS: [string, string][] = [
  ['cuisine', 'Cuisine'],
  ['phone', 'Phone'],
  ['contact:phone', 'Phone'],
  ['website', 'Website'],
  ['contact:website', 'Website'],
  ['takeaway', 'Takeaway'],
  ['delivery', 'Delivery'],
  ['outdoor_seating', 'Outdoor seating'],
  ['diet:vegetarian', 'Vegetarian options'],
  ['diet:vegan', 'Vegan options'],
  ['wheelchair', 'Wheelchair access'],
];

/** One icon + text line. */
function Row({ icon, text }: { icon: IconName; text: string }) {
  return (
    <View style={styles.row}>
      <Icon name={icon} size={14} color={colors.teal} />
      <Text variant="body" style={{ flex: 1 }}>
        {text}
      </Text>
    </View>
  );
}

/** Details of the selected place (loaded on demand). */
export function PlacePanel({ id }: { id: string }) {
  const place = usePlace(id);
  const { setDestination } = useMapContext();

  if (place.isPending) return <LoadingState />;
  if (place.isError) return <ErrorState error={place.error} onRetry={() => place.refetch()} />;

  const p = place.data;
  const meta = placeMeta(p.category);
  const seen = new Set<string>();
  const tagRows = TAG_LABELS.filter(([key]) => p.tags[key]).filter(([, label]) => !seen.has(label) && seen.add(label));

  return (
    <View style={{ gap: 8 }} testID="place-panel">
      <View style={styles.header}>
        <StatusChip label={meta.label.toUpperCase()} tone="teal" />
      </View>
      <Text variant="heading" numberOfLines={2} style={{ paddingRight: 24 }}>
        {p.name}
      </Text>
      {p.address ? <Row icon="location-outline" text={p.address} /> : null}
      <Row icon="time-outline" text={p.openingHours ?? 'Opening hours not listed'} />
      {tagRows.map(([key, label]) => (
        <Row key={key} icon="information-circle-outline" text={`${label}: ${p.tags[key]}`} />
      ))}
      <Button
        title="Directions"
        icon="navigate-outline"
        iconLeft
        small
        variant="secondary"
        onPress={() => setDestination({ coords: { lat: p.lat, lon: p.lon }, title: p.name })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
