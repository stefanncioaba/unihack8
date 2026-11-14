// Moves one vehicle marker smoothly to each new position (see vehicleAnimation.ts for the rules). On Android the
// marker's own animateMarkerToCoordinate command runs an animator on the UI thread (no JS work per frame); it cannot be
// cancelled, so a jump during a glide is sent as a command that ends just after it (jumpDurationMs). On iOS an
// AnimatedRegion timing moves Marker.Animated: that is JS-driven (one update per marker per frame), so at most
// MAX_JS_GLIDES markers glide at once and the rest jump; a pan stops those glides at once. Where neither is available
// (tests, web) the coordinate prop simply jumps to the new position.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Easing, Platform } from 'react-native';
import * as Maps from 'react-native-maps';

import {
  claimJsGlide,
  isGliding,
  isMapMoving,
  jumpDurationMs,
  onMapMoveStart,
  planMove,
  positionAt,
  releaseJsGlide,
  stillAt,
  vehiclePollGapMs,
  type VehicleMove,
} from './vehicleAnimation';

/** How a marker is moved: `native` (Android command), `animated` (iOS AnimatedRegion) or `prop` (jump). */
export type MotionMode = 'native' | 'animated' | 'prop';

/** The marker methods this hook uses (react-native-maps' MapMarker). */
type MarkerHandle = { animateMarkerToCoordinate?: (c: { latitude: number; longitude: number }, duration?: number) => void };

/** AnimatedRegion as react-native-maps exports it (missing in the test mock). */
type AnimatedRegionLike = {
  timing: (config: object) => { start: (cb?: () => void) => void };
  stopAnimation: (cb?: () => void) => void;
  setValue: (value: object) => void;
};
type AnimatedRegionClass = new (value: object) => AnimatedRegionLike;

/** The motion mode for this platform and maps build. */
export function motionMode(): MotionMode {
  if (Platform.OS === 'android') return 'native';
  const Region = (Maps as unknown as { AnimatedRegion?: unknown }).AnimatedRegion;
  const Animated = (Maps.Marker as unknown as { Animated?: unknown } | undefined)?.Animated;
  return Platform.OS === 'ios' && typeof Region === 'function' && !!Animated ? 'animated' : 'prop';
}

/** A region value for AnimatedRegion (markers only use the centre). */
const regionOf = (lat: number, lon: number) => ({ latitude: lat, longitude: lon, latitudeDelta: 0, longitudeDelta: 0 });

/** Marker position state for a vehicle at (lat, lon). Returns the mode, a ref to put on the marker, and the
 * `coordinate` to hand it: a plain object (native / prop modes; it only changes when the marker jumps) or the
 * AnimatedRegion (animated mode, for Marker.Animated). */
export function useVehicleMotion(lat: number, lon: number) {
  const mode = useMemo(motionMode, []);
  const markerRef = useRef<MarkerHandle | null>(null);
  const [plain, setPlain] = useState(() => ({ latitude: lat, longitude: lon }));
  const region = useMemo<AnimatedRegionLike | null>(() => {
    if (mode !== 'animated') return null;
    const Region = (Maps as unknown as { AnimatedRegion: AnimatedRegionClass }).AnimatedRegion;
    return new Region(regionOf(lat, lon));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const move = useRef<VehicleMove>(stillAt({ lat, lon }, Date.now()));

  /** Puts the marker at its target. `before` is the move it replaces (Android must outlast a glide still running). */
  const jump = useRef((to: { lat: number; lon: number }, before: VehicleMove, now: number) => {
    const c = { latitude: to.lat, longitude: to.lon };
    if (region) {
      region.stopAnimation();
      releaseJsGlide(region);
      region.setValue(regionOf(to.lat, to.lon));
      return;
    }
    // Native mode: the prop may already hold this value (it lags behind glides), so also send a command, timed to end
    // after any glide still running (that animator cannot be stopped and would otherwise write its old target last).
    if (mode === 'native') markerRef.current?.animateMarkerToCoordinate?.(c, jumpDurationMs(before, now));
    setPlain((p) => (p.latitude === c.latitude && p.longitude === c.longitude ? p : c));
  }).current;

  // iOS: a pan / zoom stops a running JS glide at once (no animation work while the map moves). Android's native
  // animator cannot be stopped and runs off the JS thread, so it is left to finish.
  useEffect(() => {
    if (mode !== 'animated') return undefined;
    return onMapMoveStart(() => {
      const now = Date.now();
      if (!isGliding(move.current, now)) return;
      const before = move.current;
      move.current = stillAt(before.to, now);
      jump(before.to, before, now);
    });
  }, [mode, jump]);

  // iOS: free the glide slot when the marker goes away.
  useEffect(
    () => () => {
      if (!region) return;
      region.stopAnimation();
      releaseJsGlide(region);
    },
    [region],
  );

  // A new position: glide or jump to it.
  useEffect(() => {
    const now = Date.now();
    const target = { lat, lon };
    const before = move.current;
    const shown = positionAt(before, now);
    const plan = planMove(shown, target, vehiclePollGapMs(), isMapMoving());
    if (plan.kind === 'none') return;
    // iOS: past MAX_JS_GLIDES running glides this marker jumps.
    const tooMany = !!region && plan.kind === 'animate' && !claimJsGlide(region, now, plan.duration);
    if (plan.kind === 'snap' || mode === 'prop' || tooMany) {
      move.current = stillAt(target, now);
      jump(target, before, now);
      return;
    }
    move.current = { from: shown, to: target, start: now, duration: plan.duration };
    const c = { latitude: lat, longitude: lon };
    if (region) {
      region.stopAnimation();
      region.timing({ ...regionOf(lat, lon), duration: plan.duration, easing: Easing.linear, useNativeDriver: false }).start();
    } else if (markerRef.current?.animateMarkerToCoordinate) {
      markerRef.current.animateMarkerToCoordinate(c, plan.duration);
    } else {
      setPlain(c);
    }
  }, [lat, lon, mode, region, jump]);

  return { mode, markerRef, coordinate: region ?? plain };
}
