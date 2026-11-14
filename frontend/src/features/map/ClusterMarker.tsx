// A cluster pin: a round badge with the number of pins it stands for. Tapping it zooms in.
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Marker } from 'react-native-maps';

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
  useEffect(() => {
    setTracking(true);
    return scheduleTrackingOff(() => setTracking(false));
  }, [signature]);
  return tracking;
}

type Props = { id: string; lat: number; lon: number; count: number; color: string; onPress: () => void };

/** Oxford Navy for places, yellow for events (pass the colour in). */
export function ClusterMarker({ id, lat, lon, count, color, onPress }: Props) {
  const tracking = useBriefViewTracking(`${count}:${color}`);
  return (
    <Marker testID={`cluster-${id}`} coordinate={{ latitude: lat, longitude: lon }} onPress={onPress} tracksViewChanges={tracking} anchor={{ x: 0.5, y: 0.5 }}>
      <View style={[styles.badge, { backgroundColor: color }]} accessibilityLabel={`${count} results, tap to zoom in`} collapsable={false}>
        <Text variant="cardTitle" style={{ color: color === colors.gold ? colors.onAccent : '#fff' }}>
          {count}
        </Text>
      </View>
    </Marker>
  );
}

const styles = StyleSheet.create({
  badge: {
    minWidth: 36,
    height: 36,
    paddingHorizontal: 6,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.35)',
  },
});
