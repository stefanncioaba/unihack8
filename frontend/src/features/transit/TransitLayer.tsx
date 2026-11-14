// Transit layer inside the MapView (PLAN 14.4), drawn like live.stpt.ro. With no line chosen: only the live vehicles
// in view (no route lines) and, zoomed in, the stops of the visible area. With a line chosen: that line's route for
// ONE direction (Tur / Retur), thick in the line colour over a faint wider halo, the stop dots of that direction and
// only that line's vehicles (those heading that way when their headsigns tell). Vehicles are drawn above everything.
import { memo, useCallback, useEffect, useMemo, useRef } from 'react';
import { Marker, Polyline } from 'react-native-maps';

import type { TransitStop, TransitVehicle } from '@/api/types.transit';
import type { Bbox } from '@/lib/bbox';
import { colors } from '@/ui/theme';

import { lineColor, sameLine, vehiclesInView, vehiclesOfLine, withAlpha } from './lines';
import { vehiclesInDirection, type LineDirection } from './lineView';
import { STOP_IMAGES } from './transitImages';
import { VehicleMarker } from './VehicleMarker';

/** A stop as the layer draws it (GET /transit/stops item, or a stop of the chosen line's direction). */
type LayerStop = Pick<TransitStop, 'id' | 'lat' | 'lon'> & { routes?: string[] };

type Props = {
  /** Stops in the visible area (already loaded by the map screen), or undefined while zoomed out. */
  stops: LayerStop[] | undefined;
  /** The chosen line's id, if any: only its route (one direction), stops and vehicles are shown. */
  lineId: string | null;
  /** The chosen line's directions (lineDirections), empty while its shape loads or without a line. */
  directions?: LineDirection[];
  /** Index of the shown direction in `directions`. */
  directionIndex?: number;
  /** Live vehicles of every line (GET /transit/vehicles without `route`). */
  vehicles: TransitVehicle[] | undefined;
  /** Visible area: only the vehicles in it (plus a margin) are drawn. Undefined / null draws every vehicle. */
  bbox?: Bbox | null;
  selectedStopId?: string;
  selectedVehicleId?: string;
  onSelectStop: (id: string) => void;
  onSelectVehicle: (vehicle: TransitVehicle) => void;
};

/** The chosen line's route: line width over a wider faint halo (as live.stpt.ro: 7 px over 11 px at 30 %). */
export const ROUTE_STYLE = { width: 7, haloWidth: 11, haloOpacity: 0.3 } as const;

/** Stop dot anchor (one shared object). */
const CENTER = { x: 0.5, y: 0.5 };

/** A stop: small dot (signal blue, or the line colour on a chosen line), bigger and ringed when selected. A ready-made
 * image (transitImages.ts), so it is never cut off or blank. Memoised: a vehicle refresh or a pan does not touch it. */
const StopMarker = memo(function StopMarker({ stop, selected, color, onPress }: { stop: LayerStop; selected: boolean; color: string; onPress: (id: string) => void }) {
  const coordinate = useMemo(() => ({ latitude: stop.lat, longitude: stop.lon }), [stop.lat, stop.lon]);
  const press = useCallback(() => onPress(stop.id), [onPress, stop.id]);
  const images = STOP_IMAGES[color.toLowerCase()] ?? STOP_IMAGES[colors.signal.toLowerCase()];
  return <Marker testID={`stop-marker-${stop.id}`} coordinate={coordinate} onPress={press} image={selected ? images.selected : images.normal} tracksViewChanges={false} anchor={CENTER} zIndex={10} />;
});

/** The chosen line's route for the shown direction: the halo first, then the line on top. Memoised: only a new line or
 * direction redraws it, never a vehicle refresh or a pan. */
export const LineRoute = memo(function LineRoute({ lineId, direction }: { lineId: string; direction: LineDirection }) {
  const color = lineColor(lineId);
  return (
    <>
      <Polyline
        testID={`line-route-halo-${lineId}`}
        coordinates={direction.path}
        strokeColor={withAlpha(color, ROUTE_STYLE.haloOpacity)}
        strokeWidth={ROUTE_STYLE.haloWidth}
        zIndex={2}
      />
      <Polyline testID={`line-route-${lineId}`} coordinates={direction.path} strokeColor={color} strokeWidth={ROUTE_STYLE.width} zIndex={3} />
    </>
  );
});

/** Vehicles, and the chosen line's route and stops. Only vehicles near the visible area are drawn. */
function TransitLayerBase({
  stops,
  lineId,
  directions = [],
  directionIndex = 0,
  vehicles,
  bbox,
  selectedStopId,
  selectedVehicleId,
  onSelectStop,
  onSelectVehicle,
}: Props) {
  const direction = lineId ? directions[directionIndex] ?? directions[0] : undefined;
  // A chosen line shows the stops of its shown direction; until its shape loads, the visible stops it serves.
  const shownStops = useMemo<LayerStop[]>(() => {
    if (!lineId) return stops ?? [];
    if (direction?.stops.length) return direction.stops;
    return (stops ?? []).filter((s) => s.routes?.some((r) => sameLine(r, lineId)));
  }, [stops, lineId, direction]);
  const shownVehicles = useMemo(() => {
    const ofLine = vehiclesOfLine(vehicles, lineId);
    const ofDirection = lineId ? vehiclesInDirection(ofLine, directions, Math.min(directionIndex, Math.max(0, directions.length - 1))) : ofLine;
    return vehiclesInView(ofDirection, bbox);
  }, [vehicles, lineId, directions, directionIndex, bbox]);
  const stopColor = lineId ? lineColor(lineId) : colors.signal;

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
      {lineId && direction && <LineRoute lineId={lineId} direction={direction} />}
      {shownStops.map((s) => (
        <StopMarker key={`stop-${s.id}`} stop={s} color={stopColor} selected={s.id === selectedStopId} onPress={onSelectStop} />
      ))}
      {shownVehicles.map((v) => (
        <VehicleMarker key={`vehicle-${v.id}`} vehicle={v} selected={v.id === selectedVehicleId} onPress={pressVehicle} />
      ))}
    </>
  );
}

/** The layer is memoised too: the map screen re-renders on every pan and panel change. */
export const TransitLayer = memo(TransitLayerBase);
