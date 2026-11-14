// Directions on the map (PLAN 14.5): the destination pin and the chosen route, walking legs dashed and rides solid,
// plus the live vehicles of the route's tram / trolleybus / bus lines (tap one for its vehicle panel).
import { Marker, Polyline } from 'react-native-maps';

import type { TransitVehicle } from '@/api/types.transit';
import { useMapContext } from '@/features/map/MapContext';
import { LegVehicles } from '@/features/transit/LegVehicles';
import { useRoutePlan } from '@/hooks/useRouting';
import { decodePolyline } from '@/lib/polyline';
import { colors } from '@/ui/theme';

import { useDirectionsMode } from './DirectionsContext';

/** Renders nothing until a destination is chosen. Shares the panel's cached route, so it costs no extra request. Starts at
 * the destination's `origin` when it has one (AI route preview), otherwise at the user. `hiddenVehicleIds` are vehicles
 * the Transport layer already draws. */
export function DirectionsLayer({ hiddenVehicleIds }: { hiddenVehicleIds?: ReadonlySet<string> } = {}) {
  const { destination, userPosition, selection, select } = useMapContext();
  const { mode } = useDirectionsMode();
  const plan = useRoutePlan(destination?.origin?.coords ?? userPosition, destination?.coords ?? null, mode);
  if (!destination) return null;

  /** Opens the vehicle panel and keeps this route drawn behind it. */
  const openVehicle = (v: TransitVehicle) => select({ type: 'vehicle', id: v.id, route: v.route, vehicle: v, returnTo: destination });

  return (
    <>
      <Marker
        testID="destination-marker"
        coordinate={{ latitude: destination.coords.lat, longitude: destination.coords.lon }}
        title={destination.title}
        pinColor={colors.accent}
      />
      {destination.origin && (
        <Marker
          testID="origin-marker"
          coordinate={{ latitude: destination.origin.coords.lat, longitude: destination.origin.coords.lon }}
          title={destination.origin.title}
          pinColor={colors.signal}
        />
      )}
      {plan.data?.legs.map((leg, i) => {
        const walk = leg.mode === 'WALK';
        return (
          <Polyline
            key={i}
            testID={`route-line-${i}`}
            coordinates={decodePolyline(leg.polyline).map((p) => ({ latitude: p.lat, longitude: p.lon }))}
            strokeColor={walk ? colors.signal : colors.gold}
            strokeWidth={walk ? 4 : 6}
            lineDashPattern={walk ? [8, 8] : undefined}
          />
        );
      })}
      <LegVehicles
        legs={plan.data?.legs}
        hiddenIds={hiddenVehicleIds}
        selectedId={selection?.type === 'vehicle' ? selection.id : undefined}
        onSelect={openVehicle}
      />
    </>
  );
}
