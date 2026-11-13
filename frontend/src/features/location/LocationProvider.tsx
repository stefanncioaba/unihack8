// Location permission + "current position" for the whole app (PLAN 12.5).
// When permission is denied (or the GPS fails) the position falls back to Piața Victoriei.
import * as Location from 'expo-location';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { DEFAULT_POSITION, type Coordinates } from '@/lib/geo';

export type LocationStatus = 'loading' | 'granted' | 'denied' | 'error';

export type LocationState = {
  position: Coordinates;
  status: LocationStatus;
  /** True when `position` is the default, not the phone's real position. */
  isFallback: boolean;
  /** Ask for permission / read the position again. */
  refresh: () => Promise<void>;
};

const FALLBACK_STATE: LocationState = {
  position: DEFAULT_POSITION,
  status: 'denied',
  isFallback: true,
  refresh: async () => {},
};

const LocationContext = createContext<LocationState>(FALLBACK_STATE);

/** Asks for foreground permission once enabled and keeps the latest position. */
export function LocationProvider({ children, enabled = true }: { children: ReactNode; enabled?: boolean }) {
  const [position, setPosition] = useState<Coordinates>(DEFAULT_POSITION);
  const [status, setStatus] = useState<LocationStatus>('loading');

  const refresh = useCallback(async () => {
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        setPosition(DEFAULT_POSITION);
        setStatus('denied');
        return;
      }
      const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setPosition({ lat: current.coords.latitude, lon: current.coords.longitude });
      setStatus('granted');
    } catch {
      setPosition(DEFAULT_POSITION);
      setStatus('error');
    }
  }, []);

  // Wait until the user is signed in so the permission prompt does not cover the sign-in screen.
  useEffect(() => {
    if (enabled) refresh();
  }, [enabled, refresh]);

  const value = useMemo<LocationState>(
    () => ({ position, status, isFallback: status !== 'granted', refresh }),
    [position, status, refresh],
  );
  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>;
}

/** The phone's position, or Piața Victoriei when unknown. Safe to call anywhere. */
export function useCurrentPosition(): LocationState {
  return useContext(LocationContext);
}
