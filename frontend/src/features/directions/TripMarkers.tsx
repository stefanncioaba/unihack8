// Trip guidance markers on the map (directions preview and journey mode): where to board which line and where to get
// off. The steps come from the pure tripSteps(); this file only draws them. The walk steps ("Walk 4 min") are not drawn
// on the map (the dashed line already shows the walk, and their text is in the directions panel), so the map keeps to
// the essentials: you, the destination, the route, board / get-off and the live vehicles.
import { memo, useMemo } from 'react';
import { Marker } from 'react-native-maps';

import type { RouteLeg } from '@/api/types.routing';
import type { TransitRoute } from '@/api/types.transit';
import { TRIP_IMAGES } from '@/features/transit/transitImages';

import { tripSteps, type TripStep } from './tripSteps';

/** Above the route lines, below the live vehicles (20 / 30) so a tram passing the stop stays tappable. */
const STEP_Z = { board: 16, alight: 15, walk: 12 } as const;

/** Board badges hang above the stop, get-off badges below it, walks are centred (shared objects). */
const ANCHORS = { board: { x: 0.5, y: 1 }, alight: { x: 0.5, y: 0 }, walk: { x: 0.5, y: 0.5 } } as const;

/** The badge image of a step: the line's colour (or the default one), board or get-off. Walk steps are not drawn. */
export function tripStepImage(step: Pick<TripStep, 'kind' | 'color'>): number {
  const images = TRIP_IMAGES[(step.color ?? '').toLowerCase()] ?? TRIP_IMAGES.default;
  return step.kind === 'alight' ? images.alight : images.board;
}

/** One step marker: a ready-made round badge (type icon in the line colour to board, exit icon to get off), so it is
 * never cut off. The text ("Board Bus 46 → Bastion · 19:57", "Get off at ...") is the callout shown on a tap, and it
 * is in the directions panel. Board badges sit above the stop and get-off badges below it, so a transfer at one stop
 * stays readable. */
function TripStepMarkerBase({ step }: { step: TripStep }) {
  const coordinate = useMemo(() => ({ latitude: step.coord.lat, longitude: step.coord.lon }), [step.coord.lat, step.coord.lon]);
  return (
    <Marker
      testID={`trip-step-${step.key}`}
      coordinate={coordinate}
      anchor={ANCHORS[step.kind]}
      image={tripStepImage(step)}
      title={step.label}
      tracksViewChanges={false}
      zIndex={STEP_Z[step.kind]}
    />
  );
}

export const TripStepMarker = memo(TripStepMarkerBase);

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
