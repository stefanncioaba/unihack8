// Violet pins for places in the visible area, with a short dark label when zoomed in (PLAN 14.2).
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Marker } from 'react-native-maps';

import type { PlaceSummary } from '@/api/types.places';
import { shouldCluster, clusterPoints } from '@/lib/cluster';
import type { Bbox } from '@/lib/bbox';
import { Icon } from '@/ui/Icon';
import { Text } from '@/ui/Text';
import { colors } from '@/ui/theme';

import { ClusterMarker } from './ClusterMarker';
import { placeMeta } from './placeCategories';

type Props = {
  places: PlaceSummary[];
  selectedId?: string;
  /** Show the name pill next to each pin (only sensible when zoomed in). */
  showLabels: boolean;
  onSelect: (id: string) => void;
  /** Visible area, used to group nearby pins when zoomed out. */
  bbox: Bbox | null;
  /** Zoom the map in on a point (tapping a cluster). */
  onZoomTo: (lat: number, lon: number) => void;
};

/** One pin: round violet badge with the category icon and an optional name pill. */
function PlacePin({ place, selected, showLabel }: { place: PlaceSummary; selected: boolean; showLabel: boolean }) {
  return (
    <View style={styles.pin}>
      <View style={[styles.badge, selected && styles.badgeSelected]}>
        <Icon name={placeMeta(place.category).icon} size={14} color="#fff" />
      </View>
      {(showLabel || selected) && (
        <View style={styles.label}>
          <Text variant="chip" numberOfLines={1} style={{ maxWidth: 120 }}>
            {place.name}
          </Text>
        </View>
      )}
    </View>
  );
}

/** All place pins. `tracksViewChanges` is off so hundreds of custom pins stay smooth. */
export function PlaceMarkers({ places, selectedId, showLabels, onSelect, bbox, onZoomTo }: Props) {
  const { singles, clusters } = useMemo(() => clusterPoints(places, bbox, shouldCluster(bbox)), [places, bbox]);
  return (
    <>
      {clusters.map((c) => (
        <ClusterMarker key={c.id} id={c.id} lat={c.lat} lon={c.lon} count={c.items.length} color={colors.oxford} onPress={() => onZoomTo(c.lat, c.lon)} />
      ))}
      {singles.map((p) => (
        <Marker
          key={p.id}
          testID={`place-marker-${p.id}`}
          coordinate={{ latitude: p.lat, longitude: p.lon }}
          onPress={() => onSelect(p.id)}
          tracksViewChanges={false}
          anchor={{ x: 0.5, y: 0.5 }}
        >
          <PlacePin place={p} selected={p.id === selectedId} showLabel={showLabels} />
        </Marker>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  pin: { alignItems: 'center', gap: 3 },
  badge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.oxford,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.85)',
  },
  badgeSelected: { backgroundColor: colors.accent, transform: [{ scale: 1.15 }] },
  label: {
    paddingHorizontal: 8,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    backgroundColor: 'rgba(0,8,20,0.88)',
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 3,
  },
});
