// Thin-line icons (Ionicons ship with Expo Go), plus a tiny store telling whether the icon font has loaded. Map markers
// need it: Ionicons draws nothing until its font is loaded, and a marker snapshotted before that shows a blank or
// half-drawn icon forever (tracksViewChanges is already off by then).
import { Ionicons } from '@expo/vector-icons';
import * as Font from 'expo-font';
import { useEffect, useSyncExternalStore, type ComponentProps } from 'react';

export type IconName = ComponentProps<typeof Ionicons>['name'];

type Props = { name: IconName; size?: number; color?: string };

/** One icon, default size 18. */
export function Icon({ name, size = 18, color = '#EEF3FA' }: Props) {
  return <Ionicons name={name} size={size} color={color} />;
}

// The icon font map ({ ionicons: asset }); empty when the icon set has none (e.g. a test double).
const ICON_FONT: Record<string, unknown> = (Ionicons as { font?: Record<string, unknown> }).font ?? {};
const fontListeners = new Set<() => void>();
let fontReady = Object.keys(ICON_FONT).every((name) => Font.isLoaded(name));
let fontLoading: Promise<void> | null = null;

/** True once the icon font can be drawn. */
export function iconFontLoaded(): boolean {
  return fontReady;
}

/** Loads the icon font once (later calls share the same promise) and tells every subscriber when it is ready. A failed
 * load still counts as "ready" so markers do not keep redrawing forever. */
export function loadIconFont(): Promise<void> {
  if (fontReady) return Promise.resolve();
  if (!fontLoading) {
    fontLoading = Font.loadAsync(ICON_FONT as Parameters<typeof Font.loadAsync>[0])
      .catch(() => undefined)
      .then(() => {
        fontReady = true;
        fontListeners.forEach((l) => l());
      });
  }
  return fontLoading;
}

/** Subscribes to the icon font becoming ready; returns the unsubscribe function. */
function subscribeIconFont(listener: () => void): () => void {
  fontListeners.add(listener);
  return () => fontListeners.delete(listener);
}

/** React hook: true once the icon font is loaded (starts the load on first use). */
export function useIconFontLoaded(): boolean {
  const ready = useSyncExternalStore(subscribeIconFont, iconFontLoaded, iconFontLoaded);
  useEffect(() => {
    if (!ready) void loadIconFont();
  }, [ready]);
  return ready;
}
