// Map tab. Foundation only: dark map with the user's position and an optional event pin
// ("Show on map" from event details). Filters, places, transit and directions are PLAN task 14.
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useCurrentPosition } from '@/features/location/LocationProvider';
import { isValidCoordinate, regionFor } from '@/lib/geo';
import { Icon } from '@/ui/Icon';
import { darkMapStyle } from '@/ui/mapStyle';
import { Text } from '@/ui/Text';
import { colors } from '@/ui/theme';

/** Dark map of Timișoara. */
export default function MapScreen() {
  const params = useLocalSearchParams<{ lat?: string; lon?: string; title?: string }>();
  const { position, status, refresh } = useCurrentPosition();
  const mapRef = useRef<MapView>(null);

  const lat = Number(params.lat);
  const lon = Number(params.lon);
  const focus = params.lat && params.lon && isValidCoordinate(lat, lon) ? { lat, lon } : null;

  // Fly to the requested event whenever "Show on map" is pressed again.
  useEffect(() => {
    if (focus) mapRef.current?.animateToRegion(regionFor(focus, 0.012), 400);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.lat, params.lon]);

  /** Re-centres the map on the phone's position (asks for permission again if needed). */
  async function locate() {
    await refresh();
    mapRef.current?.animateToRegion(regionFor(position), 400);
  }

  return (
    <View style={styles.root}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialRegion={regionFor(focus ?? position, focus ? 0.012 : 0.035)}
        showsUserLocation={status === 'granted'}
        showsMyLocationButton={false}
        userInterfaceStyle="dark"
        customMapStyle={darkMapStyle}
        testID="main-map"
      >
        {focus && <Marker coordinate={{ latitude: focus.lat, longitude: focus.lon }} title={params.title} pinColor={colors.violet} testID="focus-marker" />}
      </MapView>
      <SafeAreaView style={styles.overlay} edges={['top']} pointerEvents="box-none">
        <View style={styles.pill}>
          <Text variant="chip">{focus && params.title ? params.title : 'Timișoara'}</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Locate me" onPress={locate} style={styles.round}>
          <Icon name="locate-outline" size={18} />
        </Pressable>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  overlay: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: 16, paddingTop: 8 },
  pill: {
    height: 32,
    paddingHorizontal: 14,
    borderRadius: 16,
    justifyContent: 'center',
    backgroundColor: 'rgba(25,26,44,0.92)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
  },
  round: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(25,26,44,0.92)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
  },
});
