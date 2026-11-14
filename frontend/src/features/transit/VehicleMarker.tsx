// One live vehicle on the map, as on live.stpt.ro: a round badge in the line's colour (type icon + line number) over
// a soft halo, with a small arrow pointing where it is heading (when STPT knows its bearing). It glides to each new
// position (useVehicleMotion). Used by the transit layer and by the directions / journey layers for the vehicles of a
// route's ride legs.
import { memo, useCallback, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Marker } from 'react-native-maps';
import Svg, { Polygon } from 'react-native-svg';

import type { TransitVehicle } from '@/api/types.transit';
import { useBriefViewTracking } from '@/features/map/ClusterMarker';
import { Icon } from '@/ui/Icon';
import { Text } from '@/ui/Text';

import { lineColor, textOnColor, typeLabel, vehicleIcon, vehicleLineName, withAlpha } from './lines';
import { useVehicleMotion } from './useVehicleMotion';
import { arrowPoints, bearingStep } from './vehicleAnimation';

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
/** Space around the badge for the halo and the bearing arrow, on each side. */
const RING = 10;
/** The halo's extra size around the badge, on each side. */
const HALO = 4;

/** The badge's own size for a line name: round for short names, a pill for long ones. */
export function badgeSize(name: string, selected: boolean): { width: number; height: number } {
  const height = selected ? BADGE_SIZE.selected : BADGE_SIZE.normal;
  return { width: Math.max(height, 12 + Math.max(1, name.length) * CHAR_WIDTH), height };
}

/** Explicit size of a vehicle marker's root: a square that holds the badge, its halo and the bearing arrow in any
 * direction (the badge's larger side plus the ring on each side), so the native snapshot never cuts anything off. */
export function vehicleMarkerSize(name: string, selected: boolean): { width: number; height: number } {
  const b = badgeSize(name, selected);
  const side = Math.max(b.width, b.height) + 2 * RING;
  return { width: side, height: side };
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

/** Everything inside the marker root: the halo, the bearing arrow (bearing rounded to BEARING_STEP) and the badge.
 * Every child is positioned inside the root's box. */
function VehicleBodyBase({ vehicle, selected, bearing, testID }: { vehicle: TransitVehicle; selected: boolean; bearing: number | null; testID: string }) {
  const color = lineColor(vehicle.route);
  const name = vehicleLineName(vehicle);
  const root = vehicleMarkerSize(name, selected);
  const badge = badgeSize(name, selected);
  const halo = { width: badge.width + 2 * HALO, height: badge.height + 2 * HALO };
  const c = root.width / 2;
  const reach = Math.max(badge.width, badge.height) / 2;
  return (
    <View testID={testID} collapsable={false} style={[styles.root, root]}>
      <View
        collapsable={false}
        style={[
          styles.layer,
          halo,
          { left: (root.width - halo.width) / 2, top: (root.height - halo.height) / 2, borderRadius: halo.height / 2, backgroundColor: withAlpha(color, 0.3) },
        ]}
      />
      {bearing !== null && (
        <View collapsable={false} style={[styles.layer, root, styles.origin]} testID={`${testID}-arrow`}>
          <Svg width={root.width} height={root.height}>
            <Polygon points={arrowPoints(bearing, c, c, reach + 1, reach + RING - 1, 4)} fill={color} stroke="#fff" strokeWidth={1} />
          </Svg>
        </View>
      )}
      <VehicleBadge vehicle={vehicle} selected={selected} />
    </View>
  );
}

/** Body re-renders only when its look changes (badge, selection, bearing step). */
const VehicleBody = memo(
  VehicleBodyBase,
  (prev, next) => prev.selected === next.selected && prev.bearing === next.bearing && prev.testID === next.testID && sameBadge(prev.vehicle, next.vehicle),
);

/** The marker. Positions change every 5 s without a redraw of the badge: the marker glides natively to the new
 * position; the view is redrawn briefly only when its look changes (line, selection, bearing step), so Android
 * snapshots a finished badge and the map stays smooth. */
function VehicleMarkerBase({ vehicle, selected = false, idPrefix = 'vehicle-marker', onPress }: Props) {
  const bearing = bearingStep(vehicle.bearing);
  const tracking = useBriefViewTracking(`${vehicle.route}:${selected}:${bearing}`);
  const { mode, markerRef, coordinate } = useVehicleMotion(vehicle.lat, vehicle.lon);
  const press = useCallback(() => onPress(vehicle), [onPress, vehicle]);
  const MarkerComponent = useMemo(() => (mode === 'animated' ? (Marker as unknown as { Animated: typeof Marker }).Animated : Marker), [mode]);
  return (
    <MarkerComponent
      ref={markerRef as never}
      testID={`${idPrefix}-${vehicle.id}`}
      coordinate={coordinate as never}
      onPress={press}
      tracksViewChanges={tracking}
      anchor={CENTER}
      zIndex={selected ? 30 : 20}
    >
      <VehicleBody vehicle={vehicle} selected={selected} bearing={bearing} testID={`marker-root-${idPrefix}-${vehicle.id}`} />
    </MarkerComponent>
  );
}

/** Marker props compare: a refresh hands every vehicle over as a new object (its report time changes every 5 s), so
 * only what the marker shows counts: id, position, bearing step, badge look, selection and the handler. A vehicle that
 * did not move is skipped entirely. */
export function sameVehicleMarker(prev: Props, next: Props): boolean {
  return (
    prev.vehicle.id === next.vehicle.id &&
    prev.vehicle.lat === next.vehicle.lat &&
    prev.vehicle.lon === next.vehicle.lon &&
    bearingStep(prev.vehicle.bearing) === bearingStep(next.vehicle.bearing) &&
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
  layer: { position: 'absolute' },
  origin: { left: 0, top: 0 },
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
