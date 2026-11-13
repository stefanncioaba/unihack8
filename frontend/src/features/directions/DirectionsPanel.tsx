// Directions in the Map tab's bottom panel (PLAN 14.5): walking vs walking + public transport, each with its time,
// then the chosen route's arrival time, distance and steps. Both modes load at once so the times can be compared.
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import type { PlanMode, RouteLeg, RoutePlan } from '@/api/types.routing';
import type { Destination } from '@/features/map/MapContext';
import { useMapContext } from '@/features/map/MapContext';
import { useRoutePlan } from '@/hooks/useRouting';
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
  if (leg.mode === 'WALK') return `Walk to ${leg.to.name}`;
  const kind = leg.mode === 'TRAM' ? 'Tram' : leg.mode === 'TROLLEYBUS' ? 'Trolleybus' : 'Bus';
  return `${kind} ${leg.route ?? ''} → ${leg.headsign ?? leg.to.name}`.replace('  ', ' ');
}

/** The detail under a leg's title. */
function legDetail(leg: RouteLeg): string {
  if (leg.mode === 'WALK') return `${leg.durationMinutes} min`;
  return `From ${leg.from.name} at ${formatTime(leg.startsAt)} · get off at ${leg.to.name} · ${leg.durationMinutes} min`;
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
      <Icon name={icon} size={16} color={active ? colors.orangeSoft : colors.textMuted} />
      <View>
        <Text variant="chip" style={{ color: active ? colors.orangeSoft : colors.textMuted }}>
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

/** Arrival line, notes and the list of steps of one route. */
function PlanDetails({ plan, requested }: { plan: RoutePlan; requested: PlanMode }) {
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

/** Directions from the user's position to a destination. */
export function DirectionsPanel({ destination }: { destination: Destination }) {
  const { userPosition } = useMapContext();
  const { mode, setMode } = useDirectionsMode();
  const walk = useRoutePlan(userPosition, destination.coords, 'WALK');
  const transit = useRoutePlan(userPosition, destination.coords, 'TRANSIT');
  const current = mode === 'WALK' ? walk : transit;

  return (
    <View style={{ gap: 10 }} testID="directions-panel">
      <Text variant="heading" numberOfLines={2} style={{ paddingRight: 24 }}>
        Directions to {destination.title ?? 'this spot'}
      </Text>
      <View style={styles.tabs} accessibilityRole="tablist">
        <ModeTab label="Walk" icon="walk-outline" active={mode === 'WALK'} status={tabStatus(walk)} onPress={() => setMode('WALK')} />
        <ModeTab label="Walk + transit" icon="bus-outline" active={mode === 'TRANSIT'} status={tabStatus(transit)} onPress={() => setMode('TRANSIT')} />
      </View>
      {current.isPending ? (
        <LoadingState label="Finding a route…" />
      ) : current.isError ? (
        <ErrorState error={current.error} onRetry={() => current.refetch()} />
      ) : (
        <PlanDetails plan={current.data} requested={mode} />
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
  tabActive: { borderColor: colors.orangeSoft },
  leg: { flexDirection: 'row', gap: 10, alignItems: 'center', paddingVertical: 4 },
  legIcon: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceAlt },
  legIconRide: { backgroundColor: colors.orangeSoft },
});
