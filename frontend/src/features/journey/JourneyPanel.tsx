// Journey mode on the Map tab (PLAN 18.5–18.7): the route line and destination pin on the map, and a panel with the
// current step, the time and distance left and an "End" button. Replaces the normal bottom panel while it runs.
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Marker, Polyline } from 'react-native-maps';

import type { TransitVehicle } from '@/api/types.transit';
import { legIcon } from '@/features/directions/DirectionsPanel';
import { useMapContext } from '@/features/map/MapContext';
import { LegVehicles } from '@/features/transit/LegVehicles';
import { formatDistance } from '@/lib/format';
import { Button } from '@/ui/Button';
import { Icon } from '@/ui/Icon';
import { ErrorState, LoadingState } from '@/ui/States';
import { Text } from '@/ui/Text';
import { colors, radius } from '@/ui/theme';

import { legPoints, stepText } from './progress';
import type { JourneyTarget, useJourney } from './useJourney';

type Journey = ReturnType<typeof useJourney>;

/** Route line (walking dashed, rides solid), the destination pin and the live vehicles of the ride legs' lines (tap one
 * for its panel; closing it brings the journey panel back). Goes inside <MapView>. */
export function JourneyLayer({ target, journey, hiddenVehicleIds }: { target: JourneyTarget; journey: Journey; hiddenVehicleIds?: ReadonlySet<string> }) {
  const { selection, select } = useMapContext();
  /** Opens the vehicle panel over the journey. */
  const openVehicle = (v: TransitVehicle) => select({ type: 'vehicle', id: v.id, route: v.route, vehicle: v });
  // Only the legs still ahead: once off the tram, its line's vehicles are no longer interesting.
  const legsAhead = useMemo(() => journey.plan.data?.legs.slice(journey.stepIndex), [journey.plan.data, journey.stepIndex]);
  return (
    <>
      <Marker
        testID="journey-destination"
        coordinate={{ latitude: target.to.lat, longitude: target.to.lon }}
        title={target.name ?? undefined}
        pinColor={colors.accent}
      />
      {!journey.arrived &&
        journey.plan.data?.legs.map((leg, i) => {
          const walk = leg.mode === 'WALK';
          const done = i < journey.stepIndex;
          return (
            <Polyline
              key={i}
              testID={`journey-line-${i}`}
              coordinates={legPoints(leg).map((p) => ({ latitude: p.lat, longitude: p.lon }))}
              strokeColor={done ? colors.textMuted : walk ? colors.signal : colors.gold}
              strokeWidth={walk ? 5 : 7}
              lineDashPattern={walk ? [8, 8] : undefined}
            />
          );
        })}
      {!journey.arrived && (
        <LegVehicles
          legs={legsAhead}
          hiddenIds={hiddenVehicleIds}
          selectedId={selection?.type === 'vehicle' ? selection.id : undefined}
          onSelect={openVehicle}
        />
      )}
    </>
  );
}

/** The panel content for the current state of the journey. */
function JourneyBody({ target, journey }: { target: JourneyTarget; journey: Journey }) {
  const name = target.name ?? 'your destination';
  if (journey.permission === 'denied') {
    return (
      <View style={styles.body} testID="journey-permission">
        <Text variant="heading">Location needed</Text>
        <Text tone="muted">A journey follows where you are, so it needs your location. Allow location access and try again.</Text>
        <Button title="Allow location" icon="locate-outline" iconLeft small variant="secondary" onPress={journey.retryPermission} />
      </View>
    );
  }
  if (journey.arrived) {
    return (
      <View style={styles.row} testID="journey-arrived">
        <View style={[styles.badge, { backgroundColor: colors.signal }]}>
          <Icon name="flag-outline" size={18} color={colors.onAccent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="heading">You have arrived</Text>
          <Text tone="muted">{name}</Text>
        </View>
      </View>
    );
  }
  const plan = journey.plan;
  if (plan.isError && !plan.data) return <ErrorState error={plan.error} onRetry={() => plan.refetch()} />;
  if (!plan.data || !journey.progress) return <LoadingState label={journey.permission === 'checking' ? 'Finding you…' : 'Planning the route…'} />;

  const legs = plan.data.legs;
  const step = journey.progress.stepIndex;
  const leg = legs[step];
  const next = legs[step + 1];
  return (
    <View style={styles.body}>
      {leg ? (
        <View style={styles.row} testID="journey-step">
          <View style={[styles.badge, leg.mode !== 'WALK' && { backgroundColor: colors.gold }]}>
            <Icon name={legIcon(leg.mode)} size={18} color={leg.mode === 'WALK' ? colors.text : colors.onAccent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text variant="heading">{stepText(leg, step === legs.length - 1, target.name)}</Text>
            {next ? (
              <Text variant="caption" tone="muted" numberOfLines={1}>
                Then: {stepText(next, step + 1 === legs.length - 1, target.name)}
              </Text>
            ) : null}
          </View>
        </View>
      ) : null}
      <Text variant="cardTitle" testID="journey-remaining">
        {journey.progress.remainingMinutes} min · {formatDistance(journey.progress.remainingMeters)} left
      </Text>
      {plan.isFetching ? (
        <Text variant="caption" tone="accent" testID="journey-replanning">
          You left the route, finding a new one…
        </Text>
      ) : journey.movedSinceAnswer ? (
        <Text variant="caption" tone="muted" testID="journey-moved">
          You have moved since the answer, so the route starts from where you are now.
        </Text>
      ) : null}
      {plan.data.fallback ? (
        <Text variant="caption" tone="accent">
          Rough estimate in a straight line: the route planner is not available.
        </Text>
      ) : null}
    </View>
  );
}

/** Bottom card of journey mode, with "End" always available. */
export function JourneyPanel({ target, journey, onEnd }: { target: JourneyTarget; journey: Journey; onEnd: () => void }) {
  return (
    <View style={styles.wrap} pointerEvents="box-none" testID="journey-panel">
      <View style={styles.card}>
        <Text variant="caption" tone="muted" numberOfLines={1}>
          {target.mode === 'WALK' ? 'Walking' : 'Walk + public transport'} to {target.name ?? 'your destination'}
        </Text>
        <JourneyBody target={target} journey={journey} />
        <Button title={journey.arrived ? 'Done' : 'End'} icon="close" iconLeft small variant={journey.arrived ? 'primary' : 'danger'} onPress={onEnd} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 16, right: 16, bottom: 14 },
  card: {
    gap: 10,
    padding: 14,
    borderRadius: radius.card + 2,
    backgroundColor: 'rgba(0,29,61,0.97)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
  },
  body: { gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  badge: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceAlt },
});
