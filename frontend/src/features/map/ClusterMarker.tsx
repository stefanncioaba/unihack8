// A cluster pin: a round badge with the number of pins it stands for. Tapping it zooms in.
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Marker } from 'react-native-maps';

import { Text } from '@/ui/Text';
import { colors } from '@/ui/theme';

/** How long a custom marker keeps redrawing after it appears or changes, so Android can snapshot the finished view. */
export const MARKER_TRACK_MS = 800;

/** `tracksViewChanges` for a custom marker: true for a moment after mount and whenever `signature` changes, then false
 * so the map stays smooth. With it false from the start Android snapshots an empty view and the pin (or the count)
 * never shows; left true forever it costs a redraw every frame. */
export function useBriefViewTracking(signature: string | number | boolean): boolean {
  const [tracking, setTracking] = useState(true);
  useEffect(() => {
    setTracking(true);
    const timer = setTimeout(() => setTracking(false), MARKER_TRACK_MS);
    return () => clearTimeout(timer);
  }, [signature]);
  return tracking;
}

type Props = { id: string; lat: number; lon: number; count: number; color: string; onPress: () => void };

/** Oxford Navy for places, yellow for events (pass the colour in). */
export function ClusterMarker({ id, lat, lon, count, color, onPress }: Props) {
  const tracking = useBriefViewTracking(`${count}:${color}`);
  return (
    <Marker testID={`cluster-${id}`} coordinate={{ latitude: lat, longitude: lon }} onPress={onPress} tracksViewChanges={tracking} anchor={{ x: 0.5, y: 0.5 }}>
      <View style={[styles.badge, { backgroundColor: color }]} accessibilityLabel={`${count} results, tap to zoom in`} collapsable={false}>
        <Text variant="cardTitle" style={{ color: color === colors.gold ? colors.onAccent : '#fff' }}>
          {count}
        </Text>
      </View>
    </Marker>
  );
}

const styles = StyleSheet.create({
  badge: {
    minWidth: 36,
    height: 36,
    paddingHorizontal: 6,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.35)',
  },
});
