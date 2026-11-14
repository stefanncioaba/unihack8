// Transit layer inside the MapView (PLAN 14.4): every line's route drawn in its colour, every live vehicle on its
// street, and stop dots for the visible area. A chosen line is drawn on top and thicker, the others thin and faded,
// and only its vehicles and stops are shown.
import { memo, useCallback, useEffect, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { Marker, Polyline } from 'react-native-maps';

import type { TransitRoute, TransitShape, TransitStop, TransitVehicle } from '@/api/types.transit';
import { useBriefViewTracking } from '@/features/map/ClusterMarker';
import type { Bbox } from '@/lib/bbox';
import { decodePolyline } from '@/lib/polyline';
import { colors } from '@/ui/theme';

import { decodeShapes, sameLine, vehiclesInView, vehiclesOfLine, withAlpha, type DrawnShape } from './lines';
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
  /** Visible area: only the vehicles in it (plus a margin) are drawn. Undefined / null draws every vehicle. */
  bbox?: Bbox | null;
  selectedStopId?: string;
  selectedVehicleId?: string;
  onSelectStop: (id: string) => void;
  onSelectVehicle: (vehicle: TransitVehicle) => void;
};

/** Line widths: normal, chosen, and the others while one is chosen. */
export const SHAPE_WIDTH = { normal: 3, chosen: 6, faded: 2 } as const;

/** Stop dot anchor (one shared object). */
const CENTER = { x: 0.5, y: 0.5 };

/** A stop: small signal-blue dot, bigger and ringed when selected. Redraws briefly after mounting or a selection
 * change (see useBriefViewTracking) so Android does not snapshot an empty marker. Memoised: a vehicle refresh or a
 * pan does not touch it. */
const StopMarker = memo(function StopMarker({ stop, selected, onPress }: { stop: TransitStop; selected: boolean; onPress: (id: string) => void }) {
  const tracking = useBriefViewTracking(selected);
  const coordinate = useMemo(() => ({ latitude: stop.lat, longitude: stop.lon }), [stop.lat, stop.lon]);
  const press = useCallback(() => onPress(stop.id), [onPress, stop.id]);
  return (
    <Marker testID={`stop-marker-${stop.id}`} coordinate={coordinate} onPress={press} tracksViewChanges={tracking} anchor={CENTER} zIndex={10}>
      {/* Fixed-size root that holds the dot in both sizes, so the snapshot never cuts it. */}
      <View testID={`marker-root-stop-${stop.id}`} collapsable={false} style={styles.stopRoot}>
        <View collapsable={false} style={[styles.stop, selected && styles.stopSelected]} />
      </View>
    </Marker>
  );
});

/** Every line's paths. Its own memoised component: it only re-renders when the shapes or the chosen line change, never
 * on a vehicle refresh, a pan or a selection (about 180 polylines). */
export const ShapeLines = memo(function ShapeLines({ shapes, lineId }: { shapes: DrawnShape[]; lineId: string | null }) {
  return (
    <>
      {shapes.map((s, shapeIndex) => {
        const chosen = !!lineId && sameLine(s.route, lineId);
        const faded = !!lineId && !chosen;
        const color = faded ? withAlpha(s.color, 0.25) : chosen ? s.color : withAlpha(s.color, 0.8);
        const width = chosen ? SHAPE_WIDTH.chosen : faded ? SHAPE_WIDTH.faded : SHAPE_WIDTH.normal;
        return s.paths.map((path, i) => (
          <Polyline
            key={`shape-${shapeIndex}-${i}`}
            testID={`shape-line-${s.route}-${i}`}
            coordinates={path}
            strokeColor={color}
            strokeWidth={width}
            zIndex={chosen ? 3 : 1}
          />
        ));
      })}
    </>
  );
});

/** Line paths, vehicles and stops. Decoding the shapes happens once per shapes answer (memoised); only vehicles near
 * the visible area are drawn. */
function TransitLayerBase({ stops, line, vehicles, shapes, bbox, selectedStopId, selectedVehicleId, onSelectStop, onSelectVehicle }: Props) {
  const drawn = useMemo(() => decodeShapes(shapes, decodePolyline), [shapes]);
  const lineId = line?.id ?? null;
  // The chosen line last, so it is drawn above the others.
  const ordered = useMemo(
    () => (lineId ? [...drawn.filter((s) => !sameLine(s.route, lineId)), ...drawn.filter((s) => sameLine(s.route, lineId))] : drawn),
    [drawn, lineId],
  );
  const shownStops = useMemo(() => (stops && lineId ? stops.filter((s) => s.routes.some((r) => sameLine(r, lineId))) : stops ?? []), [stops, lineId]);
  const shownVehicles = useMemo(() => vehiclesInView(vehiclesOfLine(vehicles, lineId), bbox), [vehicles, lineId, bbox]);

  // One handler for every vehicle marker (so the memoised markers skip re-renders), always handing over the latest
  // report of the tapped vehicle, even when its marker was not re-rendered since.
  const latest = useRef(new Map<string, TransitVehicle>());
  useEffect(() => {
    latest.current = new Map((vehicles ?? []).map((v) => [v.id, v]));
  }, [vehicles]);
  const handler = useRef(onSelectVehicle);
  useEffect(() => {
    handler.current = onSelectVehicle;
  }, [onSelectVehicle]);
  const pressVehicle = useCallback((v: TransitVehicle) => handler.current(latest.current.get(v.id) ?? v), []);

  return (
    <>
      <ShapeLines shapes={ordered} lineId={lineId} />
      {shownStops.map((s) => (
        <StopMarker key={`stop-${s.id}`} stop={s} selected={s.id === selectedStopId} onPress={onSelectStop} />
      ))}
      {shownVehicles.map((v) => (
        <VehicleMarker key={`vehicle-${v.id}`} vehicle={v} selected={v.id === selectedVehicleId} onPress={pressVehicle} />
      ))}
    </>
  );
}

/** The layer is memoised too: the map screen re-renders on every pan and panel change. */
export const TransitLayer = memo(TransitLayerBase);

/** Side of a stop marker's root (larger than the selected dot). */
export const STOP_ROOT_SIZE = 22;

const styles = StyleSheet.create({
  stopRoot: { width: STOP_ROOT_SIZE, height: STOP_ROOT_SIZE, alignItems: 'center', justifyContent: 'center' },
  stop: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.signal, borderWidth: 2, borderColor: colors.bg },
  stopSelected: { width: 18, height: 18, borderRadius: 9, borderColor: '#fff' },
});
