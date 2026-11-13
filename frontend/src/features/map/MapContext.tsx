// Shared state of the Map tab. This is the contract between the map shell (Person 1) and the layers and panels
// built by Person 2 (transit, directions): read what you need from `useMapContext()`, do not add fields without
// agreeing it first (docs: Frontend -> Map joints).
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

import { DirectionsProvider } from '@/features/directions/DirectionsContext';
import { useDebounced } from '@/hooks/useDebounced';
import { roundBbox, type Bbox } from '@/lib/bbox';
import type { Coordinates } from '@/lib/geo';

/** What the bottom panel shows. `id` is the place / event / stop id. */
export type MapSelection =
  | { type: 'place'; id: string }
  | { type: 'event'; id: string }
  | { type: 'stop'; id: string }
  | { type: 'destination'; destination: Destination };

/** A point the user wants directions to. */
export type Destination = { coords: Coordinates; title?: string };

export type MapContextValue = {
  /** The visible area, debounced (300 ms) and rounded, ready to use as a query key. Null until the map is ready. */
  bbox: Bbox | null;
  /** The phone's position, or Piața Victoriei when unknown. */
  userPosition: Coordinates;
  /** The current bottom-panel selection (one at a time). */
  selection: MapSelection | null;
  select: (selection: MapSelection | null) => void;
  /** The chosen destination for directions, or null. Setting it opens the directions panel. */
  destination: Destination | null;
  setDestination: (destination: Destination | null) => void;
  /** Called by the map when its visible region changes (map shell only). */
  setVisibleBbox: (bbox: Bbox) => void;
};

const MapContext = createContext<MapContextValue | null>(null);

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
      destination: selection?.type === 'destination' ? selection.destination : null,
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
