// One live vehicle on the map, as on live.stpt.ro: a round badge in the line's colour (type icon + line number) over
// a soft halo. The marker is a ready-made image (transitImages.ts, drawn by scripts/generate_transit_images.py), so
// every badge is complete and the same size, whatever the phone does with views. It glides to each new position
// (useVehicleMotion). Used by the transit layer and by the directions / journey layers for the vehicles of a route's
// ride legs. (The old bearing arrow is gone: an image cannot rotate just its arrow; the panel shows the headsign.)
import { memo, useCallback, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Marker } from 'react-native-maps';

import type { TransitVehicle } from '@/api/types.transit';
import { Icon } from '@/ui/Icon';
import { Text } from '@/ui/Text';

import { lineColor, lineFamily, textOnColor, typeLabel, vehicleIcon, vehicleLineName } from './lines';
import { TYPE_IMAGES, VEHICLE_IMAGES } from './transitImages';
import { useVehicleMotion } from './useVehicleMotion';

type Props = {
  vehicle: TransitVehicle;
  selected?: boolean;
  /** testID prefix, so two layers showing vehicles can be told apart in tests. */
  idPrefix?: string;
  onPress: (vehicle: TransitVehicle) => void;
};

/** Badge height (= its width for short line names): normal and selected. */
export const BADGE_SIZE = { normal: 28, selected: 34 } as const;
/** Generous width of one line-name character in the badge (10 px bold). */
const CHAR_WIDTH = 7;
/** The badge's own size for a line name: round for short names, a pill for long ones. */
export function badgeSize(name: string, selected: boolean): { width: number; height: number } {
  const height = selected ? BADGE_SIZE.selected : BADGE_SIZE.normal;
  return { width: Math.max(height, 12 + Math.max(1, name.length) * CHAR_WIDTH), height };
}

/** The marker images of a vehicle: the badge drawn for its line, or the generic badge of its type for a line the
 * list does not know. */
export function vehicleImages(vehicle: Pick<TransitVehicle, 'route' | 'routeName'>): { normal: number; selected: number } {
  return VEHICLE_IMAGES[vehicleLineName(vehicle).trim().toUpperCase()] ?? TYPE_IMAGES[lineFamily(vehicle.route)] ?? TYPE_IMAGES.BUS;
}

/** The badge itself (also used in the vehicle panel header): round, line colour, icon over the line number. */
function VehicleBadgeBase({ vehicle, selected = false }: { vehicle: TransitVehicle; selected?: boolean }) {
  const color = lineColor(vehicle.route);
  const fg = textOnColor(color);
  const name = vehicleLineName(vehicle);
  const size = badgeSize(name, selected);
  return (
    <View
      collapsable={false}
      style={[styles.badge, size, { borderRadius: size.height / 2, backgroundColor: color }, selected && styles.selected]}
      accessibilityLabel={`${typeLabel(vehicle.type)} ${name}`}
    >
      <Icon name={vehicleIcon(vehicle.type)} size={selected ? 12 : 10} color={fg} />
      <Text variant="chip" allowFontScaling={false} numberOfLines={1} style={[styles.text, { color: fg }]}>
        {name}
      </Text>
    </View>
  );
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

/** The marker: an image that glides natively to each new position (no redraw, no re-snapshot). */
function VehicleMarkerBase({ vehicle, selected = false, idPrefix = 'vehicle-marker', onPress }: Props) {
  const { mode, markerRef, coordinate } = useVehicleMotion(vehicle.lat, vehicle.lon);
  const press = useCallback(() => onPress(vehicle), [onPress, vehicle]);
  const MarkerComponent = useMemo(() => (mode === 'animated' ? (Marker as unknown as { Animated: typeof Marker }).Animated : Marker), [mode]);
  const images = vehicleImages(vehicle);
  return (
    <MarkerComponent
      ref={markerRef as never}
      testID={`${idPrefix}-${vehicle.id}`}
      coordinate={coordinate as never}
      onPress={press}
      image={selected ? images.selected : images.normal}
      tracksViewChanges={false}
      anchor={CENTER}
      zIndex={selected ? 30 : 20}
    />
  );
}

/** Marker props compare: a refresh hands every vehicle over as a new object (its report time changes every 5 s), so
 * only what the marker shows counts: id, position, badge look, selection and the handler. A vehicle that
 * did not move is skipped entirely. */
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
  badge: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  selected: { borderWidth: 2.5 },
  text: { fontSize: 10, lineHeight: 11 },
});
