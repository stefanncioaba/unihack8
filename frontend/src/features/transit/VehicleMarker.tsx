// One live vehicle on the map: a badge in the line's colour with a tram / trolleybus / bus icon and the line number.
// Used by the transit layer and by the directions / journey layers for the vehicles of a route's ride legs.
import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Marker } from 'react-native-maps';

import type { TransitVehicle } from '@/api/types.transit';
import { useBriefViewTracking } from '@/features/map/ClusterMarker';
import { Icon } from '@/ui/Icon';
import { Text } from '@/ui/Text';

import { lineColor, typeLabel, vehicleIcon, vehicleLineName } from './lines';

type Props = {
  vehicle: TransitVehicle;
  selected?: boolean;
  /** testID prefix, so two layers showing vehicles can be told apart in tests. */
  idPrefix?: string;
  onPress: (vehicle: TransitVehicle) => void;
};

/** The badge itself (also used in the vehicle panel header). */
export function VehicleBadge({ vehicle, selected = false }: { vehicle: TransitVehicle; selected?: boolean }) {
  const color = lineColor(vehicle.route);
  return (
    <View
      collapsable={false}
      style={[styles.badge, { backgroundColor: color }, selected && styles.selected]}
      accessibilityLabel={`${typeLabel(vehicle.type)} ${vehicleLineName(vehicle)}`}
    >
      <Icon name={vehicleIcon(vehicle.type)} size={selected ? 14 : 12} color="#fff" />
      <Text variant="chip" style={styles.text}>
        {vehicleLineName(vehicle)}
      </Text>
    </View>
  );
}

/** The marker. Positions change every 10 s without a redraw of the badge; the view is redrawn briefly only when its look
 * changes (line, colour, selected), so Android snapshots a finished badge and the map stays smooth. */
function VehicleMarkerBase({ vehicle, selected = false, idPrefix = 'vehicle-marker', onPress }: Props) {
  const tracking = useBriefViewTracking(`${vehicle.route}:${selected}`);
  return (
    <Marker
      testID={`${idPrefix}-${vehicle.id}`}
      coordinate={{ latitude: vehicle.lat, longitude: vehicle.lon }}
      onPress={() => onPress(vehicle)}
      tracksViewChanges={tracking}
      anchor={{ x: 0.5, y: 0.5 }}
      zIndex={selected ? 30 : 20}
    >
      <VehicleBadge vehicle={vehicle} selected={selected} />
    </Marker>
  );
}

export const VehicleMarker = memo(VehicleMarkerBase);

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  selected: { height: 28, borderRadius: 14, paddingHorizontal: 8, borderWidth: 2.5 },
  text: { color: '#fff' },
});
