// Directions on the map (PLAN 14.5): the destination pin and the chosen route, walking legs dashed and rides solid.
import { Marker, Polyline } from 'react-native-maps';

import { useMapContext } from '@/features/map/MapContext';
import { useRoutePlan } from '@/hooks/useRouting';
import { decodePolyline } from '@/lib/polyline';
import { colors } from '@/ui/theme';

import { useDirectionsMode } from './DirectionsContext';

/** Renders nothing until a destination is chosen. Shares the panel's cached route, so it costs no extra request. Starts at
 * the destination's `origin` when it has one (AI route preview), otherwise at the user. */
export function DirectionsLayer() {
  const { destination, userPosition } = useMapContext();
  const { mode } = useDirectionsMode();
  const plan = useRoutePlan(destination?.origin?.coords ?? userPosition, destination?.coords ?? null, mode);
  if (!destination) return null;

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
    </>
  );
}
