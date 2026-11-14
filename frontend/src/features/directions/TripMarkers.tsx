// Trip guidance markers on the map (directions preview and journey mode): where to board which line, where to get off,
// and how long each walk is. The steps come from the pure tripSteps(); this file only draws them.
import { memo, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Marker } from 'react-native-maps';

import type { RouteLeg } from '@/api/types.routing';
import type { TransitRoute } from '@/api/types.transit';
import { useBriefViewTracking } from '@/features/map/ClusterMarker';
import { Icon } from '@/ui/Icon';
import { Text } from '@/ui/Text';
import { colors, radius } from '@/ui/theme';

import { tripSteps, type TripStep } from './tripSteps';

/** Above the route lines, below the live vehicles (20 / 30) so a tram passing the stop stays tappable. */
const STEP_Z = { board: 16, alight: 15, walk: 12 } as const;

/** One step marker. Board labels sit above the stop and get-off labels below it, so a transfer at one stop stays
 * readable. The view is snapshotted briefly after it appears or its label changes, then frozen. */
function TripStepMarkerBase({ step }: { step: TripStep }) {
  const tracking = useBriefViewTracking(`${step.label}:${step.color}`);
  const ride = step.kind !== 'walk';
  const anchor = step.kind === 'board' ? { x: 0.5, y: 1 } : step.kind === 'alight' ? { x: 0.5, y: 0 } : { x: 0.5, y: 0.5 };
  return (
    <Marker
      testID={`trip-step-${step.key}`}
      coordinate={{ latitude: step.coord.lat, longitude: step.coord.lon }}
      anchor={anchor}
      tracksViewChanges={tracking}
      zIndex={STEP_Z[step.kind]}
    >
      {/* The gap below a get-off stop is padding on a plain wrapper, not a margin on the marker's root view: Android
          sizes the marker snapshot from the root's own box and would cut a margin off. */}
      <View collapsable={false} style={step.kind === 'alight' ? styles.alightGap : undefined}>
        <View
          collapsable={false}
          accessibilityLabel={step.label}
          style={[styles.pill, ride ? { borderColor: step.color ?? colors.gold } : styles.walkPill]}
        >
          <View style={[styles.icon, { backgroundColor: ride ? (step.color ?? colors.gold) : colors.surfaceAlt }]}>
            <Icon name={step.icon} size={ride ? 13 : 11} color={ride ? '#fff' : colors.signal} />
          </View>
          <Text variant="chip" style={ride ? styles.rideText : styles.walkText} numberOfLines={1}>
            {step.label}
          </Text>
        </View>
      </View>
    </Marker>
  );
}

export const TripStepMarker = memo(TripStepMarkerBase);

type Props = {
  legs: RouteLeg[] | undefined;
  /** Name for the final walk ("Walk 3 min to <destination>"). */
  destinationName?: string | null;
  /** Legs before this index are already done (journey mode) and get no markers. */
  fromLeg?: number;
  /** GET /transit/routes, so ride colours match the live vehicles (leg names mapped to line ids). */
  routes?: TransitRoute[];
};

/** Every guidance marker of a plan. Goes inside <MapView>. Memoised: a pan or selection does not re-render it. */
export const TripMarkers = memo(function TripMarkers({ legs, destinationName, fromLeg = 0, routes }: Props) {
  const steps = useMemo(
    () => tripSteps(legs, destinationName, routes).filter((s) => s.legIndex >= fromLeg),
    [legs, destinationName, fromLeg, routes],
  );
  return (
    <>
      {steps.map((s) => (
        <TripStepMarker key={s.key} step={s} />
      ))}
    </>
  );
});

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    maxWidth: 240,
    paddingLeft: 3,
    paddingRight: 8,
    height: 26,
    borderRadius: radius.chip,
    borderWidth: 2,
    backgroundColor: colors.bg,
  },
  alightGap: { paddingTop: 4 },
  walkPill: { height: 22, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.overlay },
  icon: { width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  rideText: { color: colors.text },
  walkText: { color: colors.signal },
});
