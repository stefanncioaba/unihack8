// Oxford Navy pins for places in the visible area, with a short dark label when zoomed in (PLAN 14.2).
import { memo, useCallback, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Marker } from 'react-native-maps';

import type { PlaceSummary } from '@/api/types.places';
import { shouldCluster, clusterPoints } from '@/lib/cluster';
import type { Bbox } from '@/lib/bbox';
import { Icon } from '@/ui/Icon';
import { Text } from '@/ui/Text';
import { colors } from '@/ui/theme';

import { ClusterMarker, PIN_LABEL_GAP, PIN_LABEL_HEIGHT, pinBox, useBriefViewTracking } from './ClusterMarker';
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

/** Badge sizes (normal / selected), the square slot that holds either, and the widest name pill. */
export const PLACE_PIN = { badge: 28, selected: 32, slot: 34, labelText: 120, label: 136 } as const;

/** One pin: round Oxford Navy badge with the category icon and an optional name pill. The root has an explicit size
 * that holds the badge (also when selected: a bigger badge, not a scale transform that would overflow) and the pill. */
function PlacePin({ place, selected, showLabel, box }: { place: PlaceSummary; selected: boolean; showLabel: boolean; box: { width: number; height: number } }) {
  return (
    <View testID={`marker-root-place-${place.id}`} collapsable={false} style={[styles.pin, { width: box.width, height: box.height }]}>
      <View collapsable={false} style={styles.slot}>
        <View collapsable={false} style={[styles.badge, selected && styles.badgeSelected]}>
          <Icon name={placeMeta(place.category).icon} size={selected ? 16 : 14} color="#fff" />
        </View>
      </View>
      {showLabel && (
        <View collapsable={false} style={styles.label}>
          <Text variant="chip" allowFontScaling={false} numberOfLines={1} style={styles.labelText}>
            {place.name}
          </Text>
        </View>
      )}
    </View>
  );
}

/** One place marker, memoised so a pan or a panel change does not re-render every pin. It redraws briefly after it
 * appears, its look changes or the icon font loads (see useBriefViewTracking): with tracking off from the start
 * Android snapshots the pin before its icon is drawn and shows it cut off. */
const PlaceMarker = memo(function PlaceMarker({ place, selected, showLabel, onSelect }: { place: PlaceSummary; selected: boolean; showLabel: boolean; onSelect: (id: string) => void }) {
  const labelled = showLabel || selected;
  const tracking = useBriefViewTracking(`${selected}:${labelled}`);
  const box = useMemo(() => pinBox(PLACE_PIN.slot, labelled ? PLACE_PIN.label : null), [labelled]);
  const coordinate = useMemo(() => ({ latitude: place.lat, longitude: place.lon }), [place.lat, place.lon]);
  const press = useCallback(() => onSelect(place.id), [onSelect, place.id]);
  return (
    <Marker testID={`place-marker-${place.id}`} coordinate={coordinate} onPress={press} tracksViewChanges={tracking} anchor={box.anchor}>
      <PlacePin place={place} selected={selected} showLabel={labelled} box={box} />
    </Marker>
  );
});

/** All place pins. Each one redraws only briefly (shared timer), so hundreds of custom pins stay smooth. */
function PlaceMarkersBase({ places, selectedId, showLabels, onSelect, bbox, onZoomTo }: Props) {
  const { singles, clusters } = useMemo(() => clusterPoints(places, bbox, shouldCluster(bbox)), [places, bbox]);
  return (
    <>
      {clusters.map((c) => (
        <ClusterMarker key={c.id} id={c.id} lat={c.lat} lon={c.lon} count={c.items.length} color={colors.oxford} onPress={() => onZoomTo(c.lat, c.lon)} />
      ))}
      {singles.map((p) => (
        <PlaceMarker key={p.id} place={p} selected={p.id === selectedId} showLabel={showLabels} onSelect={onSelect} />
      ))}
    </>
  );
}

/** Memoised: re-renders only when its places, view, selection or labels change. */
export const PlaceMarkers = memo(PlaceMarkersBase);

const styles = StyleSheet.create({
  pin: { alignItems: 'center', overflow: 'hidden' },
  slot: { width: PLACE_PIN.slot, height: PLACE_PIN.slot, alignItems: 'center', justifyContent: 'center' },
  badge: {
    width: PLACE_PIN.badge,
    height: PLACE_PIN.badge,
    borderRadius: PLACE_PIN.badge / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.oxford,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.85)',
  },
  badgeSelected: { width: PLACE_PIN.selected, height: PLACE_PIN.selected, borderRadius: PLACE_PIN.selected / 2, backgroundColor: colors.accent },
  // No shadow: it is drawn outside the pill's box and would be cut off by the marker snapshot.
  label: {
    marginTop: PIN_LABEL_GAP,
    maxWidth: PLACE_PIN.label,
    paddingHorizontal: 8,
    height: PIN_LABEL_HEIGHT,
    borderRadius: PIN_LABEL_HEIGHT / 2,
    justifyContent: 'center',
    backgroundColor: 'rgba(0,8,20,0.88)',
  },
  labelText: { maxWidth: PLACE_PIN.labelText },
});
