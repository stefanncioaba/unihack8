// Live vehicles of a route plan's ride legs (tram / trolleybus / bus), drawn by the directions and journey layers
// whether or not the Transport filter is on, so the user sees their tram coming along the drawn road. Every vehicle of
// those lines is drawn wherever it is on the line (not only near the route or in view, up to MAX_LEG_VEHICLES_PER_LINE
// per line), so the user can watch theirs come from far away. The vehicle nearest each boarding stop (heading the right
// way when known) is drawn larger: that is most likely the one to catch.
import { memo, useCallback, useEffect, useMemo, useRef } from 'react';

import type { RouteLeg } from '@/api/types.routing';
import type { TransitRoute, TransitVehicle } from '@/api/types.transit';
import { useTransitRoutes, useVehiclesOfLines } from '@/hooks/useTransit';

import { nearestVehicle, resolveLineId, rideLegLines, vehiclesOfLine } from './lines';
import { VehicleMarker } from './VehicleMarker';

/** The line ids of the plan's ride legs (leg names mapped to /transit/routes ids) and their live vehicles. */
export function useLegVehicles(legs: RouteLeg[] | undefined) {
  const hasRide = !!legs?.some((l) => l.mode !== 'WALK');
  const routes = useTransitRoutes(hasRide);
  const lines = useMemo(() => rideLegLines(legs, routes.data), [legs, routes.data]);
  return { lines, routes: routes.data, ...useVehiclesOfLines(lines) };
}

/** Ids of the vehicle nearest each ride leg's boarding stop (of that leg's line, preferring its headsign). */
export function approachingVehicleIds(legs: RouteLeg[] | undefined, vehicles: TransitVehicle[], routes: TransitRoute[] | undefined): Set<string> {
  const out = new Set<string>();
  for (const leg of legs ?? []) {
    if (leg.mode === 'WALK' || !leg.from) continue;
    const ofLine = vehiclesOfLine(vehicles, resolveLineId(leg.route, routes));
    const best = ofLine.length ? nearestVehicle(ofLine, { lat: leg.from.lat, lon: leg.from.lon }, leg.headsign) : null;
    if (best) out.add(best.vehicle.id);
  }
  return out;
}

/** Most vehicles drawn per line of a plan: a sane cap so a bad feed cannot flood the map. */
export const MAX_LEG_VEHICLES_PER_LINE = 30;

/** At most `max` vehicles per line, in feed order, never dropping one in `keep` (the approaching vehicles). Position is
 * not considered: a vehicle far from the route or off screen is kept like any other. */
export function capVehiclesPerLine(vehicles: TransitVehicle[], max = MAX_LEG_VEHICLES_PER_LINE, keep?: ReadonlySet<string>): TransitVehicle[] {
  const count = new Map<string, number>();
  const kept = new Map<string, number>();
  // Reserve room for the kept vehicles of each line first, so the cap never pushes them out.
  for (const v of vehicles) if (keep?.has(v.id)) kept.set(lineKey(v), (kept.get(lineKey(v)) ?? 0) + 1);
  return vehicles.filter((v) => {
    const key = lineKey(v);
    if (keep?.has(v.id)) return true;
    const n = count.get(key) ?? 0;
    if (n + (kept.get(key) ?? 0) >= max) return false;
    count.set(key, n + 1);
    return true;
  });
}

/** Grouping key of a vehicle's line (ids compared like sameLine: trimmed, case-insensitive). */
function lineKey(v: TransitVehicle): string {
  return (v.route ?? '').trim().toUpperCase();
}

type Props = {
  legs: RouteLeg[] | undefined;
  selectedId?: string;
  /** Vehicles another layer already draws (the Transport layer), skipped here so they are not drawn twice. */
  hiddenIds?: ReadonlySet<string>;
  onSelect: (vehicle: TransitVehicle) => void;
};

/** Markers for the live vehicles of the ride legs' lines, drawn above the route line and the guidance markers.
 * Goes inside <MapView>. While no vehicle is selected, the one approaching each boarding stop is drawn enlarged.
 * Memoised: with stable props a pan or selection elsewhere does not re-render it. */
export const LegVehicles = memo(function LegVehicles({ legs, selectedId, hiddenIds, onSelect }: Props) {
  const { vehicles, routes } = useLegVehicles(legs);
  const approaching = useMemo(() => approachingVehicleIds(legs, vehicles, routes), [legs, vehicles, routes]);
  // No distance or in-view filter on purpose: the whole line is shown, only capped per line.
  const shown = useMemo(() => {
    const capped = capVehiclesPerLine(vehicles, MAX_LEG_VEHICLES_PER_LINE, approaching);
    return hiddenIds?.size ? capped.filter((v) => !hiddenIds.has(v.id)) : capped;
  }, [vehicles, hiddenIds, approaching]);
  // One stable handler for every marker (so the memoised markers skip refreshes where nothing moved), always handing
  // over the latest report of the tapped vehicle, even when its marker was not re-rendered since (as TransitLayer does).
  const latest = useRef(new Map<string, TransitVehicle>());
  useEffect(() => {
    latest.current = new Map(vehicles.map((v) => [v.id, v]));
  }, [vehicles]);
  const handler = useRef(onSelect);
  useEffect(() => {
    handler.current = onSelect;
  }, [onSelect]);
  const press = useCallback((v: TransitVehicle) => handler.current(latest.current.get(v.id) ?? v), []);
  return (
    <>
      {shown.map((v) => (
        <VehicleMarker
          key={`leg-vehicle-${v.id}`}
          vehicle={v}
          idPrefix="leg-vehicle-marker"
          selected={selectedId ? v.id === selectedId : approaching.has(v.id)}
          onPress={press}
        />
      ))}
    </>
  );
});
