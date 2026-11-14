// Directions on the map (PLAN 14.5): only the essentials. The destination pin (and the origin pin when the route does
// not start at the user), the chosen route (walking legs dashed, rides solid in their line's colour), the board / get
// off markers and every live vehicle of the route's tram / trolleybus / bus lines wherever it is (tap one for its
// vehicle panel). The user's own dot is MapView's; every other layer is switched off by map.tsx (visibleLayers).
import { memo, useCallback, useEffect, useMemo, useRef } from 'react';
import { Marker, Polyline } from 'react-native-maps';

import type { RouteLeg } from '@/api/types.routing';
import type { TransitRoute, TransitVehicle } from '@/api/types.transit';
import { useMapContext } from '@/features/map/MapContext';
import { LegVehicles } from '@/features/transit/LegVehicles';
import { useRoutePlan } from '@/hooks/useRouting';
import { useTransitRoutes } from '@/hooks/useTransit';
import { decodePolyline } from '@/lib/polyline';
import { colors } from '@/ui/theme';

import { useDirectionsMode } from './DirectionsContext';
import { TripMarkers } from './TripMarkers';
import { legStrokeColor } from './tripSteps';

/** Dash pattern of walking legs (one shared array, so re-renders do not hand the map a new one). */
export const WALK_DASH = [8, 8];

/** The plan's leg lines. Memoised and decoded once per plan answer: a pan or a selection re-renders the directions
 * layer (it reads the map context) but hands the native polylines the same coordinate arrays, so none is re-sent. */
export const RouteLines = memo(function RouteLines({ legs, routes }: { legs: RouteLeg[] | undefined; routes: TransitRoute[] | undefined }) {
  const paths = useMemo(() => (legs ?? []).map((leg) => decodePolyline(leg.polyline).map((p) => ({ latitude: p.lat, longitude: p.lon }))), [legs]);
  return (
    <>
      {(legs ?? []).map((leg, i) => {
        const walk = leg.mode === 'WALK';
        return (
          <Polyline
            key={i}
            testID={`route-line-${i}`}
            coordinates={paths[i]}
            strokeColor={legStrokeColor(leg, colors.signal, routes)}
            strokeWidth={walk ? 4 : 6}
            lineDashPattern={walk ? WALK_DASH : undefined}
            zIndex={walk ? 1 : 2}
          />
        );
      })}
    </>
  );
});

/** Renders nothing until a destination is chosen. Shares the panel's cached route, so it costs no extra request. Starts at
 * the destination's `origin` when it has one (AI route preview), otherwise at the user. `hiddenVehicleIds` are vehicles
 * another layer already draws. */
export function DirectionsLayer({ hiddenVehicleIds }: { hiddenVehicleIds?: ReadonlySet<string> } = {}) {
  const { destination, userPosition, selection, select } = useMapContext();
  const { mode } = useDirectionsMode();
  const plan = useRoutePlan(destination?.origin?.coords ?? userPosition, destination?.coords ?? null, mode);
  const legs = plan.data?.legs;
  const routes = useTransitRoutes(!!legs?.some((l) => l.mode !== 'WALK')).data;

  // Latest destination for the stable vehicle handler below.
  const destinationRef = useRef(destination);
  useEffect(() => {
    destinationRef.current = destination;
  }, [destination]);
  /** Opens the vehicle panel and keeps this route drawn behind it (stable, so the leg vehicle markers are not redrawn). */
  const openVehicle = useCallback(
    (v: TransitVehicle) => select({ type: 'vehicle', id: v.id, route: v.route, vehicle: v, returnTo: destinationRef.current ?? undefined }),
    [select],
  );

  const destLat = destination?.coords.lat;
  const destLon = destination?.coords.lon;
  const destCoordinate = useMemo(() => (destLat === undefined || destLon === undefined ? null : { latitude: destLat, longitude: destLon }), [destLat, destLon]);
  const originLat = destination?.origin?.coords.lat;
  const originLon = destination?.origin?.coords.lon;
  const originCoordinate = useMemo(
    () => (originLat === undefined || originLon === undefined ? null : { latitude: originLat, longitude: originLon }),
    [originLat, originLon],
  );

  if (!destination || !destCoordinate) return null;
  return (
    <>
      <Marker testID="destination-marker" coordinate={destCoordinate} title={destination.title} pinColor={colors.accent} />
      {destination.origin && originCoordinate && (
        <Marker testID="origin-marker" coordinate={originCoordinate} title={destination.origin.title} pinColor={colors.signal} />
      )}
      <RouteLines legs={legs} routes={routes} />
      <TripMarkers legs={legs} destinationName={destination.title} routes={routes} />
      <LegVehicles
        legs={legs}
        hiddenIds={hiddenVehicleIds}
        selectedId={selection?.type === 'vehicle' ? selection.id : undefined}
        onSelect={openVehicle}
      />
    </>
  );
}
