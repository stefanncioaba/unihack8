// Full-screen map where the organiser taps to place the event's pin (PLAN 13.5).
import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import MapView, { Marker, type MapPressEvent } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';

import { regionFor, type Coordinates } from '@/lib/geo';
import { Button } from '@/ui/Button';
import { Icon } from '@/ui/Icon';
import { darkMapStyle } from '@/ui/mapStyle';
import { Text } from '@/ui/Text';
import { colors } from '@/ui/theme';

type Props = {
  visible: boolean;
  /** Where the map opens, and the pin when one was already chosen. */
  center: Coordinates;
  value: Coordinates | null;
  onConfirm: (point: Coordinates) => void;
  onClose: () => void;
};

/** Tap the map to drop the pin, then confirm. */
export function LocationPickerModal({ visible, center, value, onConfirm, onClose }: Props) {
  const [point, setPoint] = useState<Coordinates | null>(value);

  // Start from the saved choice each time the picker opens.
  useEffect(() => {
    if (visible) setPoint(value);
  }, [visible, value]);

  /** Moves the pin to the tapped spot. */
  function onPress(e: MapPressEvent) {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    setPoint({ lat: latitude, lon: longitude });
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.root} testID="location-picker">
        <MapView
          style={StyleSheet.absoluteFill}
          initialRegion={regionFor(value ?? center)}
          onPress={onPress}
          toolbarEnabled={false}
          userInterfaceStyle="dark"
          customMapStyle={darkMapStyle}
          testID="picker-map"
        >
          {point && <Marker coordinate={{ latitude: point.lat, longitude: point.lon }} pinColor={colors.oxford} />}
        </MapView>
        <SafeAreaView style={styles.overlay} edges={['top', 'bottom']} pointerEvents="box-none">
          <View style={styles.top}>
            <Pressable accessibilityRole="button" accessibilityLabel="Close map" onPress={onClose} style={styles.close}>
              <Icon name="close" size={18} />
            </Pressable>
            <View style={styles.hint}>
              <Text variant="caption">{point ? 'Tap to move the pin' : 'Tap the map to place the pin'}</Text>
            </View>
          </View>
          <Button title="Use this location" icon="checkmark" disabled={!point} onPress={() => point && onConfirm(point)} />
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  overlay: { flex: 1, justifyContent: 'space-between', padding: 16 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  close: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,29,61,0.92)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
  },
  hint: { paddingHorizontal: 12, height: 32, borderRadius: 16, justifyContent: 'center', backgroundColor: 'rgba(0,29,61,0.92)' },
});
