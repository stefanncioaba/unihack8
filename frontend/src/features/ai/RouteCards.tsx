// Route cards under an assistant answer (PLAN 18.4): destination, walking / public transport and the time estimate.
// "Go" (start the journey) appears only for a route that starts where the user is; every card can preview its route.
// A tram/bus trip from the user also gets the "Leave now" box under its card (PLAN 24).
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { ChatRoute } from '@/api/types.ai';
import { routeParams } from '@/features/journey/navigation';
import { useCurrentPosition } from '@/features/location/LocationProvider';
import { formatDistance } from '@/lib/format';
import { Button } from '@/ui/Button';
import { Card } from '@/ui/Card';
import { Icon } from '@/ui/Icon';
import { Text } from '@/ui/Text';
import { colors } from '@/ui/theme';

import { LeaveNowBox } from './LeaveNowBox';

/** Asks for location permission when it is missing; true when the app may follow the user. */
export async function ensureLocationPermission(): Promise<boolean> {
  try {
    const current = await Location.getForegroundPermissionsAsync();
    if (current.status === 'granted') return true;
    const asked = await Location.requestForegroundPermissionsAsync();
    return asked.status === 'granted';
  } catch {
    return false;
  }
}

/** One planned route. */
function RouteResult({ route, index }: { route: ChatRoute; index: number }) {
  const [blocked, setBlocked] = useState(false);
  const location = useCurrentPosition();
  const walk = route.mode === 'WALK';
  const destination = route.to.name ?? 'Destination';

  /** "Go": no journey without location permission (18.7); otherwise open journey mode on the map. */
  async function go() {
    if (!(await ensureLocationPermission())) {
      setBlocked(true);
      return;
    }
    setBlocked(false);
    // Permission was just given: let the rest of the app (blue dot, distances) use the real position too.
    if (location.status !== 'granted') location.refresh();
    router.push({ pathname: '/map', params: routeParams(route, true) });
  }

  return (
    <View style={styles.list}>
      <Card style={styles.card} testID={`result-route-${index}`}>
        <View style={styles.head}>
          <View style={[styles.badge, !walk && { backgroundColor: colors.gold }]}>
            <Icon name={walk ? 'walk-outline' : 'bus-outline'} size={15} color={walk ? '#fff' : colors.onAccent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="cardTitle" numberOfLines={1}>
              {destination}
            </Text>
            <Text variant="caption" tone="muted" numberOfLines={2}>
              {[walk ? 'Walking' : 'Walk + public transport', `${route.durationMinutes} min`, formatDistance(route.distanceMeters)].join(' · ')}
              {route.startsFromUser ? '' : ` · from ${route.from.name ?? 'another place'}`}
            </Text>
          </View>
        </View>
        <View style={styles.actions}>
          {route.startsFromUser ? <Button title="Go" icon="navigate" iconLeft small onPress={go} style={{ flex: 1 }} /> : null}
          <Button
            title="Show route on map"
            icon="map-outline"
            iconLeft
            small
            variant="secondary"
            onPress={() => router.push({ pathname: '/map', params: routeParams(route, false) })}
            style={{ flex: route.startsFromUser ? 1.4 : 1 }}
          />
        </View>
        {blocked ? (
          <Text variant="caption" tone="danger" accessibilityRole="alert" testID="route-location-needed">
            Allow location access to start the journey.
          </Text>
        ) : null}
      </Card>
      {/* "Leave now" box (PLAN 24): its own box under the card, only for a tram/bus trip from the user. */}
      {route.leaveNow ? <LeaveNowBox leave={route.leaveNow} index={index} /> : null}
    </View>
  );
}

/** All route cards of one assistant message (nothing when the answer planned no route). */
export function RouteCards({ routes }: { routes: ChatRoute[] | undefined }) {
  if (!routes || routes.length === 0) return null;
  return (
    <View style={styles.list} testID="route-cards">
      {routes.map((r, i) => (
        <RouteResult key={i} route={r} index={i} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { alignSelf: 'stretch', gap: 8 },
  card: { gap: 10, padding: 12 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  badge: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.signal },
  actions: { flexDirection: 'row', gap: 8 },
});
