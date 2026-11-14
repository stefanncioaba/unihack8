// Shared state of the Map tab. This is the contract between the map shell (Person 1) and the layers and panels
// built by Person 2 (transit, directions): read what you need from `useMapContext()`, do not add fields without
// agreeing it first (docs: Frontend -> Map joints).
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

import { DirectionsProvider } from '@/features/directions/DirectionsContext';
import { useDebounced } from '@/hooks/useDebounced';
import { roundBbox, type Bbox } from '@/lib/bbox';
import type { TransitVehicle } from '@/api/types.transit';
import type { Coordinates } from '@/lib/geo';

/** What the bottom panel shows. `id` is the place / event / stop / vehicle id.
 * A vehicle keeps the snapshot it was tapped with (shown until its line's live data loads) and its line id, so the
 * panel can follow it as positions refresh. `returnTo` is the destination whose route it was tapped on: the route
 * stays drawn while the vehicle panel is open, and the panel offers a way back to the directions. */
export type MapSelection =
  | { type: 'place'; id: string }
  | { type: 'event'; id: string }
  | { type: 'stop'; id: string }
  | { type: 'vehicle'; id: string; route: string | null; vehicle: TransitVehicle; returnTo?: Destination }
  | { type: 'destination'; destination: Destination };

/** True for a selection the transport layer opened: a stop, or a vehicle not tapped from directions (no returnTo). */
export function isTransitLayerSelection(
  selection: MapSelection | null,
): selection is Extract<MapSelection, { type: 'stop' }> | Extract<MapSelection, { type: 'vehicle' }> {
  return !!selection && (selection.type === 'stop' || (selection.type === 'vehicle' && !selection.returnTo));
}

/**
 * A point the user wants directions to. `origin` is set only when the route starts somewhere other than the user
 * (an AI route "from the university", PLAN 18.4); without it directions start at the user's position.
 */
export type Destination = { coords: Coordinates; title?: string; origin?: { coords: Coordinates; title?: string } };

export type MapContextValue = {
  /** The visible area, debounced (300 ms) and rounded, ready to use as a query key. Null until the map is ready. */
  bbox: Bbox | null;
  /** The phone's position, or Piața Victoriei when unknown. */
  userPosition: Coordinates;
  /** The current bottom-panel selection (one at a time). */
  selection: MapSelection | null;
  select: (selection: MapSelection | null) => void;
  /** The chosen destination for directions, or null. Setting it opens the directions panel. It stays set while a
   * vehicle tapped on its route is shown (selection `vehicle` with `returnTo`). */
  destination: Destination | null;
  setDestination: (destination: Destination | null) => void;
  /** Called by the map when its visible region changes (map shell only). */
  setVisibleBbox: (bbox: Bbox) => void;
};

const MapContext = createContext<MapContextValue | null>(null);

/** The destination a selection keeps drawn: its own, or the one a vehicle was tapped on. */
export function destinationOf(selection: MapSelection | null): Destination | null {
  if (selection?.type === 'destination') return selection.destination;
  if (selection?.type === 'vehicle') return selection.returnTo ?? null;
  return null;
}

type ProviderProps = { userPosition: Coordinates; initialBbox: Bbox; children: ReactNode };

/** Holds the selection, destination and debounced visible area for the Map tab (plus the directions mode). */
export function MapProvider({ userPosition, initialBbox, children }: ProviderProps) {
  const [rawBbox, setRawBbox] = useState<Bbox>(initialBbox);
  const [selection, setSelection] = useState<MapSelection | null>(null);
  const debounced = useDebounced(rawBbox, 300);

  const setVisibleBbox = useCallback((b: Bbox) => setRawBbox(b), []);
  const select = useCallback((s: MapSelection | null) => setSelection(s), []);
  const setDestination = useCallback(
    (d: Destination | null) => setSelection(d ? { type: 'destination', destination: d } : null),
    [],
  );

  const value = useMemo<MapContextValue>(
    () => ({
      bbox: roundBbox(debounced),
      userPosition,
      selection,
      select,
      destination: destinationOf(selection),
      setDestination,
      setVisibleBbox,
    }),
    [debounced, userPosition, selection, select, setDestination, setVisibleBbox],
  );
  // The directions mode (14.5) lives in its own small context; providing it here keeps every map child working.
  return (
    <MapContext.Provider value={value}>
      <DirectionsProvider>{children}</DirectionsProvider>
    </MapContext.Provider>
  );
}

/** Access the map state. Only valid inside the Map tab. */
export function useMapContext(): MapContextValue {
  const ctx = useContext(MapContext);
  if (!ctx) throw new Error('useMapContext must be used inside <MapProvider>');
  return ctx;
}
