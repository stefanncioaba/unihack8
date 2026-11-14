// Transit layer inside the MapView (PLAN 14.4): every line's route drawn in its colour, every live vehicle on its
// street, and stop dots for the visible area. A chosen line is drawn on top and thicker, the others thin and faded,
// and only its vehicles and stops are shown.
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Marker, Polyline } from 'react-native-maps';

import type { TransitRoute, TransitShape, TransitStop, TransitVehicle } from '@/api/types.transit';
import { useBriefViewTracking } from '@/features/map/ClusterMarker';
import { decodePolyline } from '@/lib/polyline';
import { colors } from '@/ui/theme';

import { decodeShapes, sameLine, vehiclesOfLine, withAlpha } from './lines';
import { VehicleMarker } from './VehicleMarker';

type Props = {
  /** Stops in the visible area (already loaded by the map screen), or undefined while zoomed out. */
  stops: TransitStop[] | undefined;
  /** The chosen line, if any: it is highlighted, and only its stops and vehicles are shown. */
  line: TransitRoute | null;
  /** Live vehicles of every line (GET /transit/vehicles without `route`). */
  vehicles: TransitVehicle[] | undefined;
  /** The drawn path of every line (GET /transit/shapes). */
  shapes: TransitShape[] | undefined;
  selectedStopId?: string;
  selectedVehicleId?: string;
  onSelectStop: (id: string) => void;
  onSelectVehicle: (vehicle: TransitVehicle) => void;
};

/** Line widths: normal, chosen, and the others while one is chosen. */
export const SHAPE_WIDTH = { normal: 3, chosen: 6, faded: 2 } as const;

/** A stop: small signal-blue dot, bigger and ringed when selected. Redraws briefly after mounting or a selection
 * change (see useBriefViewTracking) so Android does not snapshot an empty marker. */
function StopMarker({ stop, selected, onPress }: { stop: TransitStop; selected: boolean; onPress: (id: string) => void }) {
  const tracking = useBriefViewTracking(selected);
  return (
    <Marker
      testID={`stop-marker-${stop.id}`}
      coordinate={{ latitude: stop.lat, longitude: stop.lon }}
      onPress={() => onPress(stop.id)}
      tracksViewChanges={tracking}
      anchor={{ x: 0.5, y: 0.5 }}
      zIndex={10}
    >
      <View collapsable={false} style={[styles.stop, selected && styles.stopSelected]} />
    </Marker>
  );
}

/** Line paths, vehicles and stops. Decoding the shapes happens once per shapes answer (memoised). */
export function TransitLayer({ stops, line, vehicles, shapes, selectedStopId, selectedVehicleId, onSelectStop, onSelectVehicle }: Props) {
  const drawn = useMemo(() => decodeShapes(shapes, decodePolyline), [shapes]);
  const lineId = line?.id ?? null;
  // The chosen line last, so it is drawn above the others.
  const ordered = useMemo(
    () => (lineId ? [...drawn.filter((s) => !sameLine(s.route, lineId)), ...drawn.filter((s) => sameLine(s.route, lineId))] : drawn),
    [drawn, lineId],
  );
  const shownStops = useMemo(() => (stops && lineId ? stops.filter((s) => s.routes.some((r) => sameLine(r, lineId))) : stops ?? []), [stops, lineId]);
  const shownVehicles = useMemo(() => vehiclesOfLine(vehicles, lineId), [vehicles, lineId]);

  return (
    <>
      {ordered.map((s, shapeIndex) => {
        const chosen = !!lineId && sameLine(s.route, lineId);
        const faded = !!lineId && !chosen;
        return s.paths.map((path, i) => (
          <Polyline
            key={`shape-${shapeIndex}-${i}`}
            testID={`shape-line-${s.route}-${i}`}
            coordinates={path}
            strokeColor={faded ? withAlpha(s.color, 0.25) : chosen ? s.color : withAlpha(s.color, 0.8)}
            strokeWidth={chosen ? SHAPE_WIDTH.chosen : faded ? SHAPE_WIDTH.faded : SHAPE_WIDTH.normal}
            zIndex={chosen ? 3 : 1}
          />
        ));
      })}
      {shownStops.map((s) => (
        <StopMarker key={`stop-${s.id}`} stop={s} selected={s.id === selectedStopId} onPress={onSelectStop} />
      ))}
      {shownVehicles.map((v) => (
        <VehicleMarker key={`vehicle-${v.id}`} vehicle={v} selected={v.id === selectedVehicleId} onPress={onSelectVehicle} />
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  stop: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.signal, borderWidth: 2, borderColor: colors.bg },
  stopSelected: { width: 18, height: 18, borderRadius: 9, borderColor: '#fff' },
});
