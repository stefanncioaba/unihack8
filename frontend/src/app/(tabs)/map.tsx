// Map tab: dark map with the user's position and the Map joints (context + bottom panel).
// Layers: places (14.2), events (14.3), transit (14.4, like live.stpt.ro: every live vehicle gliding between polls;
// pick a line, or tap one of its vehicles, to see its route one direction at a time with its stops and vehicles) and
// directions (14.5, with the live vehicles of the route's lines). Tapping a vehicle opens its live panel.
// Long-press anywhere to get directions to that spot. An AI route card opens it with a route preview, or with "Go" in
// journey mode (PLAN 18.5): the route from the live position, the camera following the user and the current step.
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import MapView, { Marker, type LongPressEvent, type MapPressEvent, type Region } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useDirectionsMode } from '@/features/directions/DirectionsContext';
import { DirectionsLayer } from '@/features/directions/DirectionsLayer';
import { JourneyLayer, JourneyPanel } from '@/features/journey/JourneyPanel';
import { parseRouteParams } from '@/features/journey/navigation';
import { useJourney, type JourneyTarget } from '@/features/journey/useJourney';
import { useCurrentPosition } from '@/features/location/LocationProvider';
import { EventMarkers } from '@/features/map/EventMarkers';
import { MapFilterBar } from '@/features/map/MapFilterBar';
import { MapPanel } from '@/features/map/MapPanel';
import type { TransitVehicle } from '@/api/types.transit';
import { MapProvider, isTransitLayerSelection, useMapContext } from '@/features/map/MapContext';
import { INITIAL_MAP_FILTERS, mapFiltersReducer, visibleLayers, type MapFilterAction } from '@/features/map/mapFilters';
import { PlaceMarkers } from '@/features/map/PlaceMarkers';
import { LinePicker } from '@/features/transit/LinePicker';
import { directionOfVehicle, lineDirections } from '@/features/transit/lineView';
import { sameLine } from '@/features/transit/lines';
import { TransitLayer } from '@/features/transit/TransitLayer';
import { setMapMoving } from '@/features/transit/vehicleAnimation';
import { useEventsInArea } from '@/hooks/useMapEvents';
import { usePlacesInArea } from '@/hooks/usePlaces';
import { useAllVehicles, useLineShape, useStopsInArea, useTransitRoutes } from '@/hooks/useTransit';
import { regionToBbox } from '@/lib/bbox';
import { decodePolyline } from '@/lib/polyline';
import { isValidCoordinate, regionFor } from '@/lib/geo';
import { MAP_CHIP_BG } from '@/ui/Chip';
import { Icon } from '@/ui/Icon';
import { darkMapStyle } from '@/ui/mapStyle';
import { Text } from '@/ui/Text';
import { colors } from '@/ui/theme';

/** Visible span (degrees of latitude) below which places are loaded / pins get name labels. */
const ZOOM_PLACES_MAX_SPAN = 0.06;
const ZOOM_LABELS_MAX_SPAN = 0.015;
/** Visible span below which transit stops are shown (about 3 km). */
const ZOOM_STOPS_MAX_SPAN = 0.03;

/** The line shown alone on the Transport layer: its id, the direction picked with the toggle (null = not picked yet)
 * and the headsign of the vehicle it was opened from (shows that vehicle's direction first). */
type LineView = { id: string; dir: number | null; headsign: string | null };

/** The map and its overlays. Must be inside <MapProvider>. */
function MapBody() {
  const params = useLocalSearchParams<{ lat?: string; lon?: string; title?: string; placeId?: string; eventId?: string; at?: string; route?: string }>();
  const { position, status, refresh } = useCurrentPosition();
  const { bbox, selection, destination, setVisibleBbox, select, setDestination } = useMapContext();
  const { setMode } = useDirectionsMode();
  const mapRef = useRef<MapView>(null);
  const [journeyTarget, setJourneyTarget] = useState<JourneyTarget | null>(null);
  const journey = useJourney(journeyTarget);
  const [filters, dispatchFilter] = useReducer(mapFiltersReducer, INITIAL_MAP_FILTERS);
  // While directions are shown (preview or journey) the filters are off: only the user, the route, its live vehicles
  // and the destination are on the map. The chosen filters come back when the directions close.
  const showingDirections = !!destination || !!journeyTarget;
  const layers = useMemo(() => visibleLayers(filters, showingDirections), [filters, showingDirections]);
  const { placesOn, categories, eventsOn, transitOn } = layers;

  // Zoomed far out there would be too many pins: ask for places only below this span (about 6 km).
  const span = bbox ? bbox.maxLat - bbox.minLat : 0;
  const zoomedIn = span > 0 && span <= ZOOM_PLACES_MAX_SPAN;
  const placesVisible = placesOn && zoomedIn;
  const places = usePlacesInArea(bbox, categories, placesVisible);
  const events = useEventsInArea(bbox, eventsOn);
  const labelsVisible = span > 0 && span <= ZOOM_LABELS_MAX_SPAN;
  const stopsVisible = transitOn && span > 0 && span <= ZOOM_STOPS_MAX_SPAN;
  const stops = useStopsInArea(bbox, stopsVisible);
  // Transport shows every live vehicle (one request); no route lines until a line is picked. The picked line's shape
  // (one direction at a time, with its stops) is fetched only then.
  const vehicles = useAllVehicles(transitOn);
  const routes = useTransitRoutes(transitOn);
  const [lineView, setLineView] = useState<LineView | null>(null);
  const lineId = transitOn ? lineView?.id ?? null : null;
  const lineShape = useLineShape(lineId);
  const directions = useMemo(() => lineDirections(lineShape.data, lineId, decodePolyline), [lineShape.data, lineId]);
  const directionIndex = lineView?.dir ?? directionOfVehicle(directions, lineView?.headsign);
  // Transport off: the next time it is on, every vehicle shows again.
  useEffect(() => {
    if (!filters.transitOn) setLineView(null);
  }, [filters.transitOn]);
  /** Picks a line in the picker (null clears it, back to every vehicle). */
  const pickLine = useCallback((id: string | null) => setLineView(id ? { id, dir: null, headsign: null } : null), []);
  /** Shows the other direction of the picked line. */
  const pickDirection = useCallback((dir: number) => setLineView((cur) => (cur ? { ...cur, dir } : cur)), []);
  /** Opens a vehicle's live panel and shows its line (in its direction); a route being previewed stays drawn. */
  const selectVehicle = useCallback(
    (v: TransitVehicle) => {
      if (v.route) setLineView((cur) => (cur && sameLine(cur.id, v.route) ? cur : { id: v.route!, dir: null, headsign: v.headsign }));
      select({ type: 'vehicle', id: v.id, route: v.route, vehicle: v, returnTo: destination ?? undefined });
    },
    [select, destination],
  );

  // Latest values for the stable handlers below (so memoised layers and the chip bar are not re-rendered for them).
  const latest = useRef({ transitOn, selection, span });
  useEffect(() => {
    latest.current = { transitOn, selection, span };
  });

  /** Applies a filter chip press. Turning transport off closes a stop or vehicle panel opened from the transport
   * layer, and turning it on closes a place or event panel (places and events are hidden): its marker is gone. */
  const changeFilter = useCallback(
    (action: MapFilterAction) => {
      const now = latest.current;
      if (action.type === 'transport') {
        const sel = now.selection;
        if (now.transitOn && isTransitLayerSelection(sel)) select(null);
        else if (!now.transitOn && (sel?.type === 'place' || sel?.type === 'event')) select(null);
      }
      dispatchFilter(action);
    },
    [select],
  );

  /** Tapping a cluster zooms in on it: to the given span, or half the current view. */
  const zoomTo = useCallback((lat: number, lon: number, targetSpan?: number) => {
    mapRef.current?.animateToRegion(regionFor({ lat, lon }, targetSpan ?? Math.max(latest.current.span / 2, 0.004)), 350);
  }, []);

  /** Opens a place / event / stop panel (stable, so the memoised markers keep their handler). */
  const selectPlace = useCallback((id: string) => select({ type: 'place', id }), [select]);
  const selectEvent = useCallback((id: string) => select({ type: 'event', id }), [select]);
  const selectStop = useCallback((id: string) => select({ type: 'stop', id }), [select]);

  const lat = Number(params.lat);
  const lon = Number(params.lon);
  const focus = params.lat && params.lon && isValidCoordinate(lat, lon) ? { lat, lon } : null;

  // Fly to the requested spot whenever "Show on map" is pressed (again), and open its panel when an id came along.
  // `at` is a timestamp so pressing the same button twice still counts as a new request.
  useEffect(() => {
    if (focus) mapRef.current?.animateToRegion(regionFor(focus, 0.012), 400);
    // Places and events are hidden while Transport is on: turn it off so the requested pin is drawn with its panel.
    if ((params.placeId || params.eventId) && filters.transitOn) dispatchFilter({ type: 'transport' });
    if (params.placeId) select({ type: 'place', id: params.placeId });
    else if (params.eventId) select({ type: 'event', id: params.eventId });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.lat, params.lon, params.placeId, params.eventId, params.at]);

  // A route from an AI answer (PLAN 18.4, 18.5): "Go" starts journey mode, otherwise the route is previewed.
  const routeRequest = useMemo(() => parseRouteParams(params), [params.route, params.at]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!routeRequest) return;
    setMode(routeRequest.mode);
    if (routeRequest.go) {
      select(null);
      setJourneyTarget({ to: routeRequest.to, name: routeRequest.toName, mode: routeRequest.mode, answeredFrom: routeRequest.from });
    } else {
      setJourneyTarget(null);
      const fromUser = routeRequest.fromName === 'Your location';
      setDestination({
        coords: routeRequest.to,
        title: routeRequest.toName ?? undefined,
        origin: fromUser ? undefined : { coords: routeRequest.from, title: routeRequest.fromName ?? undefined },
      });
      mapRef.current?.fitToCoordinates(
        [routeRequest.from, routeRequest.to].map((p) => ({ latitude: p.lat, longitude: p.lon })),
        { edgePadding: { top: 160, right: 60, bottom: 320, left: 60 }, animated: true },
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeRequest]);

  // Directions open: frame the whole trip (start and destination) so the route and its vehicles are in view.
  const tripStart = destination?.origin?.coords ?? position;
  useEffect(() => {
    if (!destination || journeyTarget) return;
    mapRef.current?.fitToCoordinates(
      [tripStart, destination.coords].map((p) => ({ latitude: p.lat, longitude: p.lon })),
      { edgePadding: { top: 160, right: 60, bottom: 320, left: 60 }, animated: true },
    );
    // Only when a new destination is chosen, not on every position update or vehicle panel toggle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [destination?.coords.lat, destination?.coords.lon]);

  // Journey mode: the camera follows the user.
  useEffect(() => {
    if (journeyTarget && journey.position) mapRef.current?.animateToRegion(regionFor(journey.position, 0.006), 500);
  }, [journeyTarget, journey.position]);

  /** Re-centres the map on the phone's position (asks for permission again if needed). */
  async function locate() {
    await refresh();
    mapRef.current?.animateToRegion(regionFor(position), 400);
  }

  /** A tap on empty map closes the panel (Android also reports marker taps here, so ignore those). */
  const onMapPress = useCallback(
    (e: MapPressEvent) => {
      if ((e.nativeEvent as { action?: string }).action === 'marker-press') return;
      select(null);
    },
    [select],
  );

  /** A long press drops a destination there and opens the directions panel. */
  const onLongPress = useCallback(
    (e: LongPressEvent) => {
      const { latitude, longitude } = e.nativeEvent.coordinate;
      setDestination({ coords: { lat: latitude, lon: longitude }, title: 'Dropped pin' });
    },
    [setDestination],
  );

  /** The camera moves (pan / zoom): vehicles stop gliding and jump until it settles. */
  const onRegionChange = useCallback(() => setMapMoving(true), []);
  /** Remembers the visible area so layers can load only what is on screen. */
  const onRegionChangeComplete = useCallback(
    (region: Region) => {
      setMapMoving(false);
      setVisibleBbox(regionToBbox(region));
    },
    [setVisibleBbox],
  );

  // The camera only uses the first region; one object, so re-renders do not hand the native map a new one.
  const [initialRegion] = useState(() => regionFor(focus ?? position, focus ? 0.012 : 0.035));
  // The directions layer as one memoised element: it re-renders on its own context changes, not on every pan or refresh.
  // No vehicles to hide in it: while directions are shown the Transport layer is off, so no vehicle is drawn twice.
  const directionsLayer = useMemo(() => <DirectionsLayer />, []);

  return (
    <View style={styles.root}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialRegion={initialRegion}
        onRegionChange={onRegionChange}
        onRegionChangeComplete={onRegionChangeComplete}
        onPress={onMapPress}
        onLongPress={onLongPress}
        showsUserLocation={status === 'granted' || (!!journeyTarget && journey.permission === 'granted')}
        showsMyLocationButton={false}
        toolbarEnabled={false}
        userInterfaceStyle="dark"
        customMapStyle={darkMapStyle}
        // Only our own data on the map: no base-map shops / museums / stations (Apple Maps; Google uses the style),
        // no 3D buildings, indoor maps, traffic or the Android "open in Google Maps" toolbar.
        showsPointsOfInterest={false}
        showsBuildings={false}
        showsIndoors={false}
        showsIndoorLevelPicker={false}
        showsTraffic={false}
        toolbarEnabled={false}
        testID="main-map"
      >
        {focus && !showingDirections && !params.placeId && !params.eventId && <Marker coordinate={{ latitude: focus.lat, longitude: focus.lon }} title={params.title} pinColor={colors.oxford} testID="focus-marker" />}
        {placesVisible && places.data && (
          <PlaceMarkers
            places={places.data.items}
            selectedId={selection?.type === 'place' ? selection.id : undefined}
            showLabels={labelsVisible}
            bbox={bbox}
            onZoomTo={zoomTo}
            onSelect={selectPlace}
          />
        )}
        {eventsOn && events.data && (
          <EventMarkers
            events={events.data.items}
            selectedId={selection?.type === 'event' ? selection.id : undefined}
            showLabels={labelsVisible}
            bbox={bbox}
            onZoomTo={zoomTo}
            onSelect={selectEvent}
          />
        )}
        {transitOn && (
          <TransitLayer
            stops={stopsVisible ? stops.data : undefined}
            lineId={lineId}
            directions={directions}
            directionIndex={directionIndex}
            vehicles={vehicles.data?.vehicles}
            bbox={bbox}
            selectedStopId={selection?.type === 'stop' ? selection.id : undefined}
            selectedVehicleId={selection?.type === 'vehicle' ? selection.id : undefined}
            onSelectStop={selectStop}
            onSelectVehicle={selectVehicle}
          />
        )}
        {journeyTarget ? (
          <JourneyLayer target={journeyTarget} journey={journey} />
        ) : (
          directionsLayer
        )}
      </MapView>

      <SafeAreaView style={styles.overlay} edges={['top']} pointerEvents="box-none">
        <View style={styles.topRow} pointerEvents="box-none">
          <Pressable accessibilityRole="button" accessibilityLabel="Locate me" onPress={locate} style={({ pressed }) => [styles.round, pressed && styles.pressed]}>
            <Icon name="locate-outline" size={18} />
          </Pressable>
        </View>
        <MapFilterBar filters={layers} onChange={changeFilter} disabled={showingDirections} />
        {transitOn && (
          <LinePicker routes={routes.data} lineId={lineId} directions={directions} directionIndex={directionIndex} onPick={pickLine} onDirection={pickDirection} />
        )}
        {showingDirections && (
          <View style={styles.hint} testID="filters-off-hint">
            <Text variant="caption" tone="muted">
              Filters are off while directions are shown
            </Text>
          </View>
        )}
        {placesOn && !zoomedIn && (
          <View style={styles.hint} testID="zoom-hint">
            <Text variant="caption" tone="muted">
              Zoom in to see places
            </Text>
          </View>
        )}
        {transitOn && !lineId && span > ZOOM_STOPS_MAX_SPAN && (
          <View style={styles.hint} testID="stops-hint">
            <Text variant="caption" tone="muted">
              Zoom in to see stops
            </Text>
          </View>
        )}
        {transitOn && vehicles.data && (vehicles.data.vehicles.length === 0 || vehicles.data.stale) && (
          <View style={styles.hint} testID="vehicles-hint">
            <Text variant="caption" tone="muted">
              {vehicles.data.vehicles.length === 0 ? 'No vehicles running right now' : 'Live positions are delayed'}
            </Text>
          </View>
        )}
      </SafeAreaView>

      {/* In journey mode a tapped vehicle's panel shows over the journey panel; closing it brings the journey back. */}
      {journeyTarget && selection?.type !== 'vehicle' ? (
        <JourneyPanel target={journeyTarget} journey={journey} onEnd={() => setJourneyTarget(null)} />
      ) : (
        <MapPanel />
      )}
    </View>
  );
}

/** Dark map of Timișoara. */
export default function MapScreen() {
  const { position } = useCurrentPosition();
  return (
    <MapProvider userPosition={position} initialBbox={regionToBbox(regionFor(position))}>
      <MapBody />
    </MapProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  overlay: { paddingHorizontal: 16, paddingTop: 8, gap: 10 },
  hint: {
    alignSelf: 'center',
    paddingHorizontal: 12,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    backgroundColor: MAP_CHIP_BG,
  },
  topRow: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'flex-start' },
  round: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: MAP_CHIP_BG,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
  },
  // Same feedback as the chips: dim and shrink a little, keep the colours.
  pressed: { opacity: 0.8, transform: [{ scale: 0.94 }] },
});
