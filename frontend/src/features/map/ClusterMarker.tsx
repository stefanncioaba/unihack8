// A cluster pin: a round badge with the number of pins it stands for. Tapping it zooms in.
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Marker } from 'react-native-maps';

import { useIconFontLoaded } from '@/ui/Icon';
import { Text } from '@/ui/Text';
import { colors } from '@/ui/theme';

/** How long a custom marker keeps redrawing after it appears or changes, so Android can snapshot the finished view. */
export const MARKER_TRACK_MS = 800;

/** Markers whose tracking ends within this many ms of the earliest one are switched off in the same pass. */
export const TRACK_BATCH_SLACK_MS = 32;

// One shared timer for every marker: callbacks waiting to switch tracking off, with the time they are due, and the due
// time the timer is armed for (Infinity when it is not armed).
const pendingTrackingOff = new Map<() => void, number>();
let trackingTimer: ReturnType<typeof setTimeout> | null = null;
let armedDue = Infinity;
let armCount = 0;

/** Arms the shared timer for `due`. */
function armAt(due: number) {
  if (trackingTimer) clearTimeout(trackingTimer);
  armedDue = due;
  if (due !== Infinity) armCount++;
  trackingTimer = due === Infinity ? null : setTimeout(flushTrackingOff, Math.max(0, due - Date.now()));
}

/** Runs every callback that is due (plus the small slack) in one task, so React commits them as one update instead of
 * one re-render and native commit per marker (hundreds of vehicles mount at once). Then re-arms for the next one: the
 * only full scan of the pending markers, once per flush. */
function flushTrackingOff() {
  trackingTimer = null;
  armedDue = Infinity;
  const limit = Date.now() + TRACK_BATCH_SLACK_MS;
  const due: (() => void)[] = [];
  for (const [cb, at] of pendingTrackingOff) if (at <= limit) due.push(cb);
  due.forEach((cb) => pendingTrackingOff.delete(cb));
  due.forEach((cb) => cb());
  let earliest = Infinity;
  for (const at of pendingTrackingOff.values()) earliest = Math.min(earliest, at);
  if (earliest < armedDue) armAt(earliest);
}

/** Calls `cb` after `ms` on the shared marker timer; returns a cancel function. Constant time: the timer is only re-armed
 * when this one is due before the armed time, and a cancel just forgets the callback (a flush with nothing due re-arms
 * for the rest), so hundreds of markers mounting or unmounting together stay cheap. */
export function scheduleTrackingOff(cb: () => void, ms: number = MARKER_TRACK_MS): () => void {
  const due = Date.now() + ms;
  pendingTrackingOff.set(cb, due);
  if (due < armedDue) armAt(due);
  return () => {
    pendingTrackingOff.delete(cb);
    if (pendingTrackingOff.size === 0) armAt(Infinity);
  };
}

/** How many times the shared timer has been armed so far (tests). */
export function trackingTimerArms(): number {
  return armCount;
}

/** True while the shared timer is armed (tests). */
export function trackingTimerArmed(): boolean {
  return trackingTimer !== null;
}

/** Number of markers waiting on the shared timer (tests). */
export function pendingTrackingCount(): number {
  return pendingTrackingOff.size;
}

/** `tracksViewChanges` for a custom marker: true for a moment after mount and whenever `signature` changes, then false
 * so the map stays smooth. With it false from the start Android snapshots an empty view and the pin (or the count)
 * never shows; left true forever it costs a redraw every frame. All markers share one timer (see flushTrackingOff). */
export function useBriefViewTracking(signature: string | number | boolean): boolean {
  const [tracking, setTracking] = useState(true);
  const fontReady = useIconFontLoaded();
  useEffect(() => {
    setTracking(true);
    // Icons draw nothing until the icon font is loaded: keep tracking until then, and snapshot again once it is.
    if (!fontReady) return undefined;
    return scheduleTrackingOff(() => setTracking(false));
  }, [signature, fontReady]);
  return tracking || !fontReady;
}

/** Cluster bubble height (and minimum width). */
const CLUSTER_HEIGHT = 36;

/** Exact size of a cluster bubble for a count: wide enough for every digit plus the ring, so nothing is cut off. */
export function clusterSize(count: number): { width: number; height: number } {
  const digits = String(Math.max(0, Math.floor(count))).length;
  return { width: Math.max(CLUSTER_HEIGHT, 20 + digits * 9), height: CLUSTER_HEIGHT };
}

type Props = { id: string; lat: number; lon: number; count: number; color: string; onPress: () => void };

/** Oxford Navy for places, yellow for events (pass the colour in). The root view has the bubble's exact size, so the
 * native snapshot always holds the whole bubble. */
export function ClusterMarker({ id, lat, lon, count, color, onPress }: Props) {
  const tracking = useBriefViewTracking(`${count}:${color}`);
  const size = clusterSize(count);
  return (
    <Marker testID={`cluster-${id}`} coordinate={{ latitude: lat, longitude: lon }} onPress={onPress} tracksViewChanges={tracking} anchor={CENTER}>
      <View
        testID={`marker-root-cluster-${id}`}
        style={[styles.badge, size, { borderRadius: size.height / 2, backgroundColor: color }]}
        accessibilityLabel={`${count} results, tap to zoom in`}
        collapsable={false}
      >
        <Text variant="cardTitle" allowFontScaling={false} numberOfLines={1} style={{ color: color === colors.gold ? colors.onAccent : '#fff' }}>
          {count}
        </Text>
      </View>
    </Marker>
  );
}

/** Bubble anchor: its middle sits on the cluster's position (one shared object). */
const CENTER = { x: 0.5, y: 0.5 };

/** Space between a round pin and its name pill, and the pill's height. */
export const PIN_LABEL_GAP = 3;
export const PIN_LABEL_HEIGHT = 20;

/** Box of a round pin's marker root: a square slot for the badge (sized for its larger, selected look) and, when a name
 * pill is shown, room for the pill under it at its widest. The anchor keeps the badge's centre on the coordinate. Every
 * child fits inside this box, so Android / iOS snapshot the whole pin instead of cutting part of it off. */
export function pinBox(slot: number, labelWidth: number | null): { width: number; height: number; anchor: { x: number; y: number } } {
  if (labelWidth === null) return { width: slot, height: slot, anchor: CENTER };
  const height = slot + PIN_LABEL_GAP + PIN_LABEL_HEIGHT;
  return { width: Math.max(slot, labelWidth), height, anchor: { x: 0.5, y: slot / 2 / height } };
}

const styles = StyleSheet.create({
  badge: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.35)',
  },
});
