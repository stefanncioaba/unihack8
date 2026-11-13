// A cluster pin: a round badge with the number of pins it stands for. Tapping it zooms in.
import { StyleSheet, View } from 'react-native';
import { Marker } from 'react-native-maps';

import { Text } from '@/ui/Text';
import { colors } from '@/ui/theme';

type Props = { id: string; lat: number; lon: number; count: number; color: string; onPress: () => void };

/** Violet for places, orange for events (pass the colour in). */
export function ClusterMarker({ id, lat, lon, count, color, onPress }: Props) {
  return (
    <Marker testID={`cluster-${id}`} coordinate={{ latitude: lat, longitude: lon }} onPress={onPress} tracksViewChanges={false} anchor={{ x: 0.5, y: 0.5 }}>
      <View style={[styles.badge, { backgroundColor: color }]} accessibilityLabel={`${count} results, tap to zoom in`}>
        <Text variant="cardTitle" style={{ color: color === colors.orangeSoft ? colors.onAccent : '#fff' }}>
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
