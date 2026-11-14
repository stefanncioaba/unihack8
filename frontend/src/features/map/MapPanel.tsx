// The one bottom panel of the Map tab. Shows whatever `selection` says: a place, an event, a transit stop, a live
// vehicle or directions. Person 1 owns the container and the place / event panels; the stop (14.4) and directions (14.5) panels
// live in features/transit and features/directions.
import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { DirectionsPanel } from '@/features/directions/DirectionsPanel';
import { StopPanel } from '@/features/transit/StopPanel';
import { VehiclePanel } from '@/features/transit/VehiclePanel';
import { Icon } from '@/ui/Icon';
import { colors, radius } from '@/ui/theme';

import { EventPanel } from './EventPanel';
import { useMapContext, type MapSelection } from './MapContext';
import { PlacePanel } from './PlacePanel';

/** The content for one kind of selection. */
function PanelContent({ selection }: { selection: MapSelection }) {
  switch (selection.type) {
    case 'place':
      return <PlacePanel id={selection.id} />;
    case 'event':
      return <EventPanel id={selection.id} />;
    case 'stop':
      return <StopPanel stopId={selection.id} />;
    case 'vehicle':
      return <VehiclePanel id={selection.id} route={selection.route} snapshot={selection.vehicle} returnTo={selection.returnTo} />;
    case 'destination':
      return <DirectionsPanel destination={selection.destination} />;
  }
}

/** Card above the tab bar with a close button; renders nothing when nothing is selected. */
function MapPanelBase() {
  const { selection, select } = useMapContext();
  if (!selection) return null;
  return (
    <View style={styles.wrap} pointerEvents="box-none" testID="map-panel">
      <View style={styles.card}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close panel" onPress={() => select(null)} style={styles.close} hitSlop={8}>
          <Icon name="close" size={16} color={colors.textMuted} />
        </Pressable>
        <PanelContent selection={selection} />
      </View>
    </View>
  );
}

/** Memoised (no props): it follows the map context, not the map screen's re-renders on every pan or refresh. */
export const MapPanel = memo(MapPanelBase);

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 16, right: 16, bottom: 14 },
  card: {
    padding: 14,
    borderRadius: radius.card + 2,
    // Oxford Navy (lighter than the dark map) with a pale signal-blue edge, so the card stands out from the map.
    backgroundColor: colors.oxford,
    borderWidth: 1,
    borderColor: 'rgba(142,197,255,0.45)',
    shadowColor: '#000',
    shadowOpacity: 0.55,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 10,
  },
  close: { position: 'absolute', top: 10, right: 10, zIndex: 2 },
});
