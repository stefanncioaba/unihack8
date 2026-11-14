// Live vehicles of a route plan's ride legs (tram / trolleybus / bus), drawn by the directions and journey layers
// whether or not the Transport filter is on, so the user sees their tram coming along the drawn road.
import { useMemo } from 'react';

import type { RouteLeg } from '@/api/types.routing';
import type { TransitVehicle } from '@/api/types.transit';
import { useTransitRoutes, useVehiclesOfLines } from '@/hooks/useTransit';

import { rideLegLines } from './lines';
import { VehicleMarker } from './VehicleMarker';

/** The line ids of the plan's ride legs (leg names mapped to /transit/routes ids) and their live vehicles. */
export function useLegVehicles(legs: RouteLeg[] | undefined) {
  const hasRide = !!legs?.some((l) => l.mode !== 'WALK');
  const routes = useTransitRoutes(hasRide);
  const lines = useMemo(() => rideLegLines(legs, routes.data), [legs, routes.data]);
  return { lines, ...useVehiclesOfLines(lines) };
}

type Props = {
  legs: RouteLeg[] | undefined;
  selectedId?: string;
  /** Vehicles another layer already draws (the Transport layer), skipped here so they are not drawn twice. */
  hiddenIds?: ReadonlySet<string>;
  onSelect: (vehicle: TransitVehicle) => void;
};

/** Markers for the live vehicles of the ride legs' lines. Goes inside <MapView>. */
export function LegVehicles({ legs, selectedId, hiddenIds, onSelect }: Props) {
  const { vehicles } = useLegVehicles(legs);
  const shown = useMemo(() => (hiddenIds?.size ? vehicles.filter((v) => !hiddenIds.has(v.id)) : vehicles), [vehicles, hiddenIds]);
  return (
    <>
      {shown.map((v) => (
        <VehicleMarker key={`leg-vehicle-${v.id}`} vehicle={v} idPrefix="leg-vehicle-marker" selected={v.id === selectedId} onPress={onSelect} />
      ))}
    </>
  );
}
