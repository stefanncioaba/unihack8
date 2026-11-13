// The one bottom panel of the Map tab. Shows whatever `selection` says: a place, an event, a transit stop or
// directions. Person 1 owns the container and the place / event panels; Person 2 mounts the stop and directions panels.
import { Pressable, StyleSheet, View } from 'react-native';

import { Icon } from '@/ui/Icon';
import { Text } from '@/ui/Text';
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
      // PERSON 2: render <StopPanel stopId={selection.id} /> here (step 14.4).
      return null;
    case 'destination':
      // PERSON 2: replace this placeholder with <DirectionsPanel destination={selection.destination} /> (step 14.5).
      return <Text tone="muted">Directions to {selection.destination.title ?? 'this spot'} are coming soon.</Text>;
  }
}

/** Card above the tab bar with a close button; renders nothing when nothing is selected. */
export function MapPanel() {
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

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 16, right: 16, bottom: 14 },
  card: {
    padding: 14,
    borderRadius: radius.card + 2,
    backgroundColor: 'rgba(25,26,44,0.97)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  close: { position: 'absolute', top: 10, right: 10, zIndex: 2 },
});
