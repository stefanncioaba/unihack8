// Which travel mode the directions panel shows (PLAN 14.5). Shared by the panel (tabs) and the map layer (drawn route).
// Kept apart from MapContext, whose fields are the agreed contract with the map shell; MapProvider provides it.
import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

import type { PlanMode } from '@/api/types.routing';

type DirectionsValue = { mode: PlanMode; setMode: (mode: PlanMode) => void };

const DirectionsContext = createContext<DirectionsValue | null>(null);

/** Holds the chosen mode; walking + public transport is the default. */
export function DirectionsProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<PlanMode>('TRANSIT');
  const value = useMemo(() => ({ mode, setMode }), [mode]);
  return <DirectionsContext.Provider value={value}>{children}</DirectionsContext.Provider>;
}

/** The chosen mode. Only valid inside the Map tab. */
export function useDirectionsMode(): DirectionsValue {
  const ctx = useContext(DirectionsContext);
  if (!ctx) throw new Error('useDirectionsMode must be used inside <DirectionsProvider>');
  return ctx;
}
