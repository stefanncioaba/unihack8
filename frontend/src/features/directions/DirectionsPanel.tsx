// Directions in the Map tab's bottom panel (PLAN 14.5): walking vs walking + public transport, each with its time,
// then the chosen route's arrival time, distance and steps. Both modes load at once so the times can be compared.
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import type { PlanMode, RouteLeg, RoutePlan } from '@/api/types.routing';
import type { Destination } from '@/features/map/MapContext';
import { useMapContext } from '@/features/map/MapContext';
import { lineColor, nearestVehicle, resolveLineId, typeLabel, vehicleLineName } from '@/features/transit/lines';
import { useRoutePlan } from '@/hooks/useRouting';
import { useTransitRoutes, useVehiclesOfLines } from '@/hooks/useTransit';
import { formatDistance } from '@/lib/format';
import { formatTime } from '@/lib/time';
import { Icon, type IconName } from '@/ui/Icon';
import { ErrorState, LoadingState } from '@/ui/States';
import { Text } from '@/ui/Text';
import { colors } from '@/ui/theme';

import { useDirectionsMode } from './DirectionsContext';

/** Icon for a leg mode. */
export function legIcon(mode: RouteLeg['mode']): IconName {
  switch (mode) {
    case 'WALK':
      return 'walk-outline';
    case 'TRAM':
      return 'train-outline';
    default:
      return 'bus-outline';
  }
}

/** One readable line per leg: `Walk to Piața Libertății` / `Tram 1 → Gara de Nord`. */
export function legTitle(leg: RouteLeg): string {
  const to = leg.to?.name ?? 'your stop';
  if (leg.mode === 'WALK') return `Walk to ${leg.to?.name ?? 'the destination'}`;
  const kind = leg.mode === 'TRAM' ? 'Tram' : leg.mode === 'TROLLEYBUS' ? 'Trolleybus' : 'Bus';
  return `${kind} ${leg.route ?? ''} → ${leg.headsign ?? to}`.replace('  ', ' ');
}

/** The detail under a leg's title. */
function legDetail(leg: RouteLeg): string {
  if (leg.mode === 'WALK') return `${leg.durationMinutes} min`;
  const at = leg.startsAt ? ` at ${formatTime(leg.startsAt)}` : '';
  return `From ${leg.from?.name ?? 'the stop'}${at} · get off at ${leg.to?.name ?? 'your stop'} · ${leg.durationMinutes} min`;
}

/** One of the two mode tabs, with that mode's time (or a short status). */
function ModeTab({ label, icon, active, status, onPress }: { label: string; icon: IconName; active: boolean; status: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[styles.tab, active && styles.tabActive]}
    >
      <Icon name={icon} size={16} color={active ? colors.gold : colors.textMuted} />
      <View>
        <Text variant="chip" style={{ color: active ? colors.gold : colors.textMuted }}>
          {label}
        </Text>
        <Text variant="cardTitle">{status}</Text>
      </View>
    </Pressable>
  );
}

/** The time shown on a tab. */
function tabStatus(q: { isPending: boolean; isError: boolean; data?: RoutePlan }): string {
  if (q.isPending) return '…';
  if (q.isError || !q.data) return 'Unavailable';
  return `${q.data.durationMinutes} min`;
}

/** The live vehicle of the first ride leg's line nearest its boarding stop (heading the leg's way when known).
 * Tapping it opens the vehicle panel; the route stays drawn behind it. Renders nothing without a ride or a vehicle. */
function NextVehicle({ legs, destination }: { legs: RouteLeg[]; destination: Destination }) {
  const { select } = useMapContext();
  const ride = legs.find((l) => l.mode !== 'WALK');
  const routes = useTransitRoutes(!!ride);
  const lineId = ride ? resolveLineId(ride.route, routes.data) : null;
  const { vehicles } = useVehiclesOfLines(lineId ? [lineId] : []);
  if (!ride?.from) return null;
  const near = nearestVehicle(vehicles, ride.from, ride.headsign);
  if (!near) return null;
  const v = near.vehicle;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Show the nearest vehicle"
      onPress={() => select({ type: 'vehicle', id: v.id, route: v.route, vehicle: v, returnTo: destination })}
      style={styles.next}
      testID="next-vehicle"
    >
      <View style={[styles.dot, { backgroundColor: lineColor(v.route) }]} />
      <Text variant="caption" style={{ flex: 1 }}>
        Live: {typeLabel(v.type).toLowerCase()} {vehicleLineName(v)} is {formatDistance(near.meters)} from {ride.from.name}
      </Text>
      <Icon name="chevron-forward" size={14} color={colors.textMuted} />
    </Pressable>
  );
}

/** Arrival line, notes and the list of steps of one route. */
function PlanDetails({ plan, requested, destination }: { plan: RoutePlan; requested: PlanMode; destination: Destination }) {
  return (
    <View style={{ gap: 8 }} testID="route-details">
      <Text variant="cardTitle">
        Arrive {formatTime(plan.endsAt)} · {formatDistance(plan.distanceMeters)}
      </Text>
      {requested === 'TRANSIT' && plan.mode === 'WALK' && (
        <Text variant="caption" tone="muted">
          No public transport is faster right now, so this is the walking route.
        </Text>
      )}
      {plan.fallback && (
        <Text variant="caption" tone="accent">
          Rough estimate in a straight line: the route planner is not available.
        </Text>
      )}
      <NextVehicle legs={plan.legs} destination={destination} />
      <ScrollView style={{ maxHeight: 190 }} nestedScrollEnabled>
        {plan.legs.map((leg, i) => (
          <View key={i} style={styles.leg} testID="route-leg">
            <View style={[styles.legIcon, leg.mode !== 'WALK' && styles.legIconRide]}>
              <Icon name={legIcon(leg.mode)} size={14} color={leg.mode === 'WALK' ? colors.text : colors.onAccent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text>{legTitle(leg)}</Text>
              <Text variant="caption" tone="muted">
                {legDetail(leg)}
              </Text>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

/** Directions from the user's position (or the destination's `origin`, for an AI route preview) to a destination. */
export function DirectionsPanel({ destination }: { destination: Destination }) {
  const { userPosition } = useMapContext();
  const { mode, setMode } = useDirectionsMode();
  const from = destination.origin?.coords ?? userPosition;
  const walk = useRoutePlan(from, destination.coords, 'WALK');
  const transit = useRoutePlan(from, destination.coords, 'TRANSIT');
  const current = mode === 'WALK' ? walk : transit;

  return (
    <View style={{ gap: 10 }} testID="directions-panel">
      <Text variant="heading" numberOfLines={2} style={{ paddingRight: 24 }}>
        Directions to {destination.title ?? 'this spot'}
      </Text>
      {destination.origin ? (
        <Text variant="caption" tone="muted" testID="directions-origin">
          From {destination.origin.title ?? 'the chosen start'}
        </Text>
      ) : null}
      <View style={styles.tabs} accessibilityRole="tablist">
        <ModeTab label="Walk" icon="walk-outline" active={mode === 'WALK'} status={tabStatus(walk)} onPress={() => setMode('WALK')} />
        <ModeTab label="Walk + transit" icon="bus-outline" active={mode === 'TRANSIT'} status={tabStatus(transit)} onPress={() => setMode('TRANSIT')} />
      </View>
      {current.isPending ? (
        <LoadingState label="Finding a route…" />
      ) : current.isError ? (
        <ErrorState error={current.error} onRetry={() => current.refetch()} />
      ) : (
        <PlanDetails plan={current.data} requested={mode} destination={destination} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: 'row', gap: 8 },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 8,
    borderRadius: 12,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  tabActive: { borderColor: colors.gold },
  leg: { flexDirection: 'row', gap: 10, alignItems: 'center', paddingVertical: 4 },
  legIcon: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceAlt },
  legIconRide: { backgroundColor: colors.gold },
  next: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 10, backgroundColor: colors.surfaceAlt },
  dot: { width: 10, height: 10, borderRadius: 5 },
});
