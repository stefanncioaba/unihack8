// Trip guidance markers on the map (directions preview and journey mode): where to board which line and where to get
// off. The steps come from the pure tripSteps(); this file only draws them. The walk steps ("Walk 4 min") are not drawn
// on the map (the dashed line already shows the walk, and their text is in the directions panel), so the map keeps to
// the essentials: you, the destination, the route, board / get-off and the live vehicles.
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
  const anchor = ANCHORS[step.kind];
  const box = useMemo(() => tripStepSize(step.kind, step.label), [step.kind, step.label]);
  return (
    <Marker
      testID={`trip-step-${step.key}`}
      coordinate={{ latitude: step.coord.lat, longitude: step.coord.lon }}
      anchor={anchor}
      tracksViewChanges={tracking}
      zIndex={STEP_Z[step.kind]}
    >
      {/* The root has an explicit size that holds the whole pill; the gap below a get-off stop is padding inside it,
          not a margin: Android sizes the marker snapshot from the root's own box and would cut a margin off. */}
      <View
        testID={`marker-root-step-${step.key}`}
        collapsable={false}
        style={[styles.root, box, step.kind === 'alight' ? styles.alightGap : undefined]}
      >
        <View
          collapsable={false}
          accessibilityLabel={step.label}
          style={[styles.pill, { maxWidth: box.width }, ride ? { borderColor: step.color ?? colors.gold } : styles.walkPill]}
        >
          <View style={[styles.icon, { backgroundColor: ride ? (step.color ?? colors.gold) : colors.surfaceAlt }]}>
            <Icon name={step.icon} size={ride ? 13 : 11} color={ride ? '#fff' : colors.signal} />
          </View>
          <Text variant="chip" allowFontScaling={false} style={[styles.label, ride ? styles.rideText : styles.walkText]} numberOfLines={1}>
            {step.label}
          </Text>
        </View>
      </View>
    </Marker>
  );
}

export const TripStepMarker = memo(TripStepMarkerBase);

/** Board labels hang above the stop, get-off labels below it, walks are centred (shared objects). */
const ANCHORS = { board: { x: 0.5, y: 1 }, alight: { x: 0.5, y: 0 }, walk: { x: 0.5, y: 0.5 } } as const;

/** Pill heights, the gap below a get-off stop, the widest pill and a generous width per label character. */
export const TRIP_PILL = { ride: 26, walk: 22, alightGap: 4, maxWidth: 240, charWidth: 7.5 } as const;

/** Explicit size of a step marker's root: the pill's width for its label (icon, gaps, padding, borders), capped at the
 * widest pill (the label is cut with "..." beyond that), and its height plus the get-off gap. */
export function tripStepSize(kind: TripStep['kind'], label: string): { width: number; height: number } {
  const ride = kind !== 'walk';
  const chrome = 3 + 18 + 5 + 8 + (ride ? 4 : 2) + 4;
  const width = Math.min(TRIP_PILL.maxWidth, Math.ceil(chrome + label.length * TRIP_PILL.charWidth));
  const height = (ride ? TRIP_PILL.ride : TRIP_PILL.walk) + (kind === 'alight' ? TRIP_PILL.alightGap : 0);
  return { width, height };
}

/** The step kinds drawn as map markers (walk labels stay in the panel only). */
export const MAP_STEP_KINDS: ReadonlySet<TripStep['kind']> = new Set(['board', 'alight']);

type Props = {
  legs: RouteLeg[] | undefined;
  /** Name for the final walk ("Walk 3 min to <destination>"). */
  destinationName?: string | null;
  /** Legs before this index are already done (journey mode) and get no markers. */
  fromLeg?: number;
  /** GET /transit/routes, so ride colours match the live vehicles (leg names mapped to line ids). */
  routes?: TransitRoute[];
};

/** The board / get-off markers of a plan (see MAP_STEP_KINDS). Goes inside <MapView>. Memoised: a pan or selection
 * does not re-render it. */
export const TripMarkers = memo(function TripMarkers({ legs, destinationName, fromLeg = 0, routes }: Props) {
  const steps = useMemo(
    () => tripSteps(legs, destinationName, routes).filter((s) => s.legIndex >= fromLeg && MAP_STEP_KINDS.has(s.kind)),
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
  root: { alignItems: 'center', justifyContent: 'flex-end' },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingLeft: 3,
    paddingRight: 8,
    height: TRIP_PILL.ride,
    borderRadius: radius.chip,
    borderWidth: 2,
    backgroundColor: colors.bg,
  },
  alightGap: { paddingTop: TRIP_PILL.alightGap },
  label: { flexShrink: 1 },
  walkPill: { height: TRIP_PILL.walk, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.overlay },
  icon: { width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  rideText: { color: colors.text },
  walkText: { color: colors.signal },
});
