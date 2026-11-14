// One live vehicle on the map: a badge in the line's colour with a tram / trolleybus / bus icon and the line number.
// Used by the transit layer and by the directions / journey layers for the vehicles of a route's ride legs.
import { memo, useCallback, useMemo } from 'react';
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
function VehicleBadgeBase({ vehicle, selected = false }: { vehicle: TransitVehicle; selected?: boolean }) {
  const color = lineColor(vehicle.route);
  return (
    <View
      collapsable={false}
      style={[styles.badge, { backgroundColor: color }, selected && styles.selected]}
      accessibilityLabel={`${typeLabel(vehicle.type)} ${vehicleLineName(vehicle)}`}
    >
      <Icon name={vehicleIcon(vehicle.type)} size={selected ? 14 : 12} color="#fff" />
      <Text variant="chip" allowFontScaling={false} numberOfLines={1} style={styles.text}>
        {vehicleLineName(vehicle)}
      </Text>
    </View>
  );
}

/** Generous width of one line-name character in the badge (11 px bold). */
const CHAR_WIDTH = 8;

/** Explicit size of a vehicle marker's root: the badge's widest possible size for its line name (borders, padding,
 * icon, gap, text) plus a little slack, so the native snapshot never cuts the badge off. */
export function vehicleMarkerSize(name: string, selected: boolean): { width: number; height: number } {
  const chars = Math.max(1, name.length);
  const width = selected ? 2 * 2.5 + 2 * 8 + 14 + 3 + chars * CHAR_WIDTH : 2 * 1.5 + 2 * 6 + 12 + 3 + chars * CHAR_WIDTH;
  return { width: Math.ceil(width) + 6, height: selected ? 32 : 26 };
}

/** True when two vehicles draw the same badge (line, name, type), whatever their position or report time. */
export function sameBadge(a: TransitVehicle, b: TransitVehicle): boolean {
  return a.route === b.route && a.routeName === b.routeName && a.type === b.type;
}

/** The badge only re-renders when its look changes: a moved vehicle keeps its badge (no child update in the marker,
 * so Android does not re-snapshot it). */
export const VehicleBadge = memo(
  VehicleBadgeBase,
  (prev, next) => prev.selected === next.selected && sameBadge(prev.vehicle, next.vehicle),
);

/** The marker. Positions change every 10 s without a redraw of the badge; the view is redrawn briefly only when its look
 * changes (line, colour, selected), so Android snapshots a finished badge and the map stays smooth. */
function VehicleMarkerBase({ vehicle, selected = false, idPrefix = 'vehicle-marker', onPress }: Props) {
  const tracking = useBriefViewTracking(`${vehicle.route}:${selected}`);
  // Same coordinate object while the vehicle has not moved, so the native marker is not updated.
  const coordinate = useMemo(() => ({ latitude: vehicle.lat, longitude: vehicle.lon }), [vehicle.lat, vehicle.lon]);
  const press = useCallback(() => onPress(vehicle), [onPress, vehicle]);
  const name = vehicleLineName(vehicle);
  const size = useMemo(() => vehicleMarkerSize(name, selected), [name, selected]);
  return (
    <Marker
      testID={`${idPrefix}-${vehicle.id}`}
      coordinate={coordinate}
      onPress={press}
      tracksViewChanges={tracking}
      anchor={CENTER}
      zIndex={selected ? 30 : 20}
    >
      {/* A root with an explicit size that fully holds the badge, the badge centred in it. */}
      <View testID={`marker-root-${idPrefix}-${vehicle.id}`} collapsable={false} style={[styles.root, size]}>
        <VehicleBadge vehicle={vehicle} selected={selected} />
      </View>
    </Marker>
  );
}

/** Marker props compare: a refresh hands every vehicle over as a new object (its report time changes every 10 s), so
 * only what the marker shows counts: id, position, badge look, selection and the handler. A vehicle that did not move
 * is skipped entirely. */
export function sameVehicleMarker(prev: Props, next: Props): boolean {
  return (
    prev.vehicle.id === next.vehicle.id &&
    prev.vehicle.lat === next.vehicle.lat &&
    prev.vehicle.lon === next.vehicle.lon &&
    sameBadge(prev.vehicle, next.vehicle) &&
    (prev.selected ?? false) === (next.selected ?? false) &&
    prev.idPrefix === next.idPrefix &&
    prev.onPress === next.onPress
  );
}

export const VehicleMarker = memo(VehicleMarkerBase, sameVehicleMarker);

/** Badge anchor: its middle sits on the vehicle's position (one shared object, not a new one per render). */
const CENTER = { x: 0.5, y: 0.5 };

const styles = StyleSheet.create({
  root: { alignItems: 'center', justifyContent: 'center' },
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
