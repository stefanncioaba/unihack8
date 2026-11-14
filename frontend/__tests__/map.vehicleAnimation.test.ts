// Smooth vehicle movement (like live.stpt.ro): the interpolation and snap rule, the poll and map-motion stores, the
// bearing arrow helpers, the JS-glide budget, and the marker hook driving react-native-maps' native animation on
// Android and AnimatedRegion on iOS.
import { act, renderHook } from '@testing-library/react-native';
import { Platform } from 'react-native';
import * as Maps from 'react-native-maps';

import {
  FRAME_MS,
  MAX_JS_GLIDES,
  SNAP_AFTER_MS,
  VEHICLE_ANIMATION_MS,
  arrowPoints,
  bearingStep,
  claimJsGlide,
  isGliding,
  isMapMoving,
  jumpDurationMs,
  lerpCoord,
  onMapMoveStart,
  planMove,
  positionAt,
  recordVehiclePoll,
  releaseJsGlide,
  resetJsGlides,
  resetVehiclePolls,
  runningJsGlides,
  setMapMoving,
  stillAt,
  vehiclePollGapMs,
} from '@/features/transit/vehicleAnimation';
import { motionMode, useVehicleMotion } from '@/features/transit/useVehicleMotion';

const A = { lat: 45.75, lon: 21.22 };
const B = { lat: 45.751, lon: 21.221 }; // about 135 m away
const FAR = { lat: 45.8, lon: 21.3 }; // several km away

afterEach(() => {
  resetVehiclePolls();
  resetJsGlides();
  setMapMoving(false);
});

describe('interpolation', () => {
  it('moves linearly from one point to the next, clamped to the ends', () => {
    expect(lerpCoord(A, B, 0)).toEqual(A);
    expect(lerpCoord(A, B, 1)).toEqual(B);
    const mid = lerpCoord(A, B, 0.5);
    expect(mid.lat).toBeCloseTo(45.7505, 6);
    expect(mid.lon).toBeCloseTo(21.2205, 6);
    expect(lerpCoord(A, B, -1)).toEqual(A);
    expect(lerpCoord(A, B, 3)).toEqual(B);
    expect(lerpCoord(A, B, Number.NaN)).toEqual(B);
  });

  it('knows where a marker is during and after a glide', () => {
    const move = { from: A, to: B, start: 1000, duration: 4000 };
    expect(positionAt(move, 1000)).toEqual(A);
    expect(positionAt(move, 3000).lat).toBeCloseTo(45.7505, 6);
    expect(positionAt(move, 9000)).toEqual(B);
    expect(isGliding(move, 3000)).toBe(true);
    expect(isGliding(move, 5000)).toBe(false);
    expect(positionAt(stillAt(A, 0), 99)).toEqual(A);
    expect(isGliding(stillAt(A, 0), 0)).toBe(false);
  });
});

describe('snap rule', () => {
  it('glides over ~4.8 s between two regular polls', () => {
    expect(planMove(A, B, 5000, false)).toEqual({ kind: 'animate', duration: VEHICLE_ANIMATION_MS });
    expect(VEHICLE_ANIMATION_MS).toBeLessThan(5000);
  });

  it('does nothing when the vehicle did not move', () => {
    expect(planMove(A, { ...A }, 5000, false)).toEqual({ kind: 'none' });
  });

  it('jumps after a long gap, a long jump, or while the map moves', () => {
    expect(planMove(A, B, SNAP_AFTER_MS + 1, false)).toEqual({ kind: 'snap' });
    expect(planMove(A, B, Infinity, false)).toEqual({ kind: 'snap' });
    expect(planMove(A, FAR, 5000, false)).toEqual({ kind: 'snap' });
    expect(planMove(A, B, 5000, true)).toEqual({ kind: 'snap' });
    expect(planMove(A, B, SNAP_AFTER_MS, false).kind).toBe('animate'); // 12 s exactly still glides
  });
});

describe('poll and map-motion stores', () => {
  it('measures the gap between the last two polls, merging polls that land together', () => {
    expect(vehiclePollGapMs()).toBe(Infinity);
    recordVehiclePoll(10_000);
    expect(vehiclePollGapMs()).toBe(Infinity); // one poll only: the first positions never glide
    recordVehiclePoll(10_500); // another query answering at the same moment
    expect(vehiclePollGapMs()).toBe(Infinity);
    recordVehiclePoll(15_000);
    expect(vehiclePollGapMs()).toBe(5000);
    recordVehiclePoll(45_000);
    expect(vehiclePollGapMs()).toBe(30_000);
  });

  it('tells listeners when a pan starts, once per pan', () => {
    const listener = jest.fn();
    const off = onMapMoveStart(listener);
    setMapMoving(true);
    setMapMoving(true); // every frame of the same pan
    expect(isMapMoving()).toBe(true);
    expect(listener).toHaveBeenCalledTimes(1);
    setMapMoving(false);
    expect(isMapMoving()).toBe(false);
    off();
    setMapMoving(true);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe('jump timing and the JS-glide budget', () => {
  it('times a jump to end just after a native glide still running, and at once otherwise', () => {
    const move = { from: A, to: B, start: 1000, duration: 4800 };
    expect(jumpDurationMs(move, 2000)).toBe(3800 + FRAME_MS);
    expect(jumpDurationMs(move, 5800)).toBe(0);
    expect(jumpDurationMs(stillAt(A, 0), 10)).toBe(0);
  });

  it('lets at most MAX_JS_GLIDES markers glide at once, freeing slots as glides end or stop', () => {
    const owners = Array.from({ length: MAX_JS_GLIDES + 1 }, () => ({}));
    owners.slice(0, MAX_JS_GLIDES).forEach((o) => expect(claimJsGlide(o, 0, 4800)).toBe(true));
    expect(runningJsGlides(0)).toBe(MAX_JS_GLIDES);
    expect(claimJsGlide(owners[MAX_JS_GLIDES], 0, 4800)).toBe(false);
    expect(claimJsGlide(owners[0], 100, 4800)).toBe(true); // restarting its own glide needs no extra slot
    releaseJsGlide(owners[1]);
    expect(claimJsGlide(owners[MAX_JS_GLIDES], 100, 4800)).toBe(true);
    expect(runningJsGlides(10_000)).toBe(0); // all ended
    expect(claimJsGlide({}, 10_000, 4800)).toBe(true);
  });
});

describe('bearing arrow', () => {
  it('rounds bearings to steps and keeps unknown ones unknown', () => {
    expect(bearingStep(null)).toBeNull();
    expect(bearingStep(undefined)).toBeNull();
    expect(bearingStep(Number.NaN)).toBeNull();
    expect(bearingStep(0)).toBe(0);
    expect(bearingStep(8)).toBe(15);
    expect(bearingStep(359)).toBe(0);
    expect(bearingStep(-90)).toBe(270);
    expect(bearingStep(725)).toBe(0);
  });

  it('points the arrow tip in the bearing direction', () => {
    const tip = (b: number) => arrowPoints(b, 20, 20, 10, 18, 4).split(' ')[0];
    expect(tip(0)).toBe('20,2'); // north: up
    expect(tip(90)).toBe('38,20'); // east: right
    expect(tip(180)).toBe('20,38'); // south: down
    expect(tip(270)).toBe('2,20');
    expect(arrowPoints(0, 20, 20, 10, 18, 4).split(' ')).toEqual(['20,2', '24,10', '16,10']);
  });
});

describe('useVehicleMotion', () => {
  it('jumps the coordinate prop where no native animation exists (tests, web)', () => {
    expect(motionMode()).toBe('prop'); // the test mock has no AnimatedRegion / Marker.Animated
    const { result, rerender } = renderHook(({ lat, lon }: { lat: number; lon: number }) => useVehicleMotion(lat, lon), { initialProps: A });
    const first = result.current.coordinate;
    expect(first).toEqual({ latitude: A.lat, longitude: A.lon });
    rerender({ ...A });
    expect(result.current.coordinate).toBe(first);
    rerender(B);
    expect(result.current.coordinate).toEqual({ latitude: B.lat, longitude: B.lon });
  });

  describe('on Android', () => {
    const os = Platform.OS;
    beforeEach(() => {
      jest.useFakeTimers();
      (Platform as { OS: string }).OS = 'android';
    });
    afterEach(() => {
      (Platform as { OS: string }).OS = os;
      jest.useRealTimers();
    });

    /** Mounts the hook with a fake marker exposing animateMarkerToCoordinate. */
    function mount() {
      const animate = jest.fn();
      const hook = renderHook(({ lat, lon }: { lat: number; lon: number }) => {
        const m = useVehicleMotion(lat, lon);
        m.markerRef.current = { animateMarkerToCoordinate: animate };
        return m;
      }, { initialProps: A });
      return { animate, ...hook };
    }

    it('glides natively over 4.8 s between regular polls and leaves the prop alone', () => {
      expect(motionMode()).toBe('native');
      const { animate, result, rerender } = mount();
      const prop = result.current.coordinate;
      recordVehiclePoll(Date.now());
      jest.advanceTimersByTime(5000);
      recordVehiclePoll(Date.now());
      rerender(B);
      expect(animate).toHaveBeenCalledWith({ latitude: B.lat, longitude: B.lon }, VEHICLE_ANIMATION_MS);
      expect(result.current.coordinate).toBe(prop); // the prop would cut the native glide short
    });

    it('jumps (0 ms) after a long gap or a long jump', () => {
      const { animate, result, rerender } = mount();
      recordVehiclePoll(Date.now());
      jest.advanceTimersByTime(30_000);
      recordVehiclePoll(Date.now());
      rerender(B); // 30 s since the previous poll
      expect(animate).toHaveBeenLastCalledWith({ latitude: B.lat, longitude: B.lon }, 0);
      expect(result.current.coordinate).toEqual({ latitude: B.lat, longitude: B.lon });
      jest.advanceTimersByTime(5000);
      recordVehiclePoll(Date.now());
      rerender(FAR);
      expect(animate).toHaveBeenLastCalledWith({ latitude: FAR.lat, longitude: FAR.lon }, 0);
    });

    it('leaves a running native glide alone on a pan, and jumps a new position that arrives mid-pan', () => {
      const { animate, rerender } = mount();
      recordVehiclePoll(Date.now());
      jest.advanceTimersByTime(5000);
      recordVehiclePoll(Date.now());
      rerender(B);
      expect(animate).toHaveBeenLastCalledWith({ latitude: B.lat, longitude: B.lon }, VEHICLE_ANIMATION_MS);
      const calls = animate.mock.calls.length;
      act(() => setMapMoving(true)); // the UI-thread animator cannot be stopped: no extra command
      expect(animate).toHaveBeenCalledTimes(calls);
      jest.advanceTimersByTime(5000);
      recordVehiclePoll(Date.now());
      rerender(A); // a new position mid-pan, the glide is over
      expect(animate).toHaveBeenLastCalledWith({ latitude: A.lat, longitude: A.lon }, 0);
    });

    it('ends at the snapped position when a snap lands while a glide still runs (newest animator ends last)', () => {
      // Simulated native animators: none is ever cancelled, and the one that ends last decides where the marker stays.
      const animators: { to: { latitude: number; longitude: number }; end: number }[] = [];
      const { animate, rerender } = mount();
      animate.mockImplementation((to: { latitude: number; longitude: number }, duration?: number) => {
        animators.push({ to, end: Date.now() + (duration ?? 0) });
      });
      recordVehiclePoll(Date.now());
      jest.advanceTimersByTime(5000);
      recordVehiclePoll(Date.now());
      rerender(B); // glide A -> B
      jest.advanceTimersByTime(1000);
      act(() => setMapMoving(true));
      rerender(FAR); // snap mid-glide (map moving, and over 1 km)
      const last = [...animators].sort((a, b) => a.end - b.end).pop();
      expect(last?.to).toEqual({ latitude: FAR.lat, longitude: FAR.lon });
      expect(animate).toHaveBeenLastCalledWith({ latitude: FAR.lat, longitude: FAR.lon }, VEHICLE_ANIMATION_MS - 1000 + FRAME_MS);
    });
  });

  describe('on iOS', () => {
    const os = Platform.OS;
    const maps = Maps as unknown as { AnimatedRegion?: unknown; Marker: { Animated?: unknown } };
    // Number of fake AnimatedRegion timings running right now.
    let running = 0;
    /** Fake AnimatedRegion: a timing runs for its duration or until stopped; setValue moves it at once. */
    class FakeRegion {
      private active = false;
      constructor(public value: object) {}
      /** Starts counting a running timing. */
      timing(config: { duration: number }) {
        return {
          start: () => {
            this.stop();
            this.active = true;
            running += 1;
            setTimeout(() => this.stop(), config.duration);
          },
        };
      }
      /** Ends the running timing, if any. */
      private stop() {
        if (!this.active) return;
        this.active = false;
        running -= 1;
      }
      /** Like AnimatedRegion.stopAnimation. */
      stopAnimation() {
        this.stop();
      }
      /** Like AnimatedRegion.setValue. */
      setValue(value: object) {
        this.value = value;
      }
    }
    /** Mounts `n` vehicle hooks at A. */
    const mountMany = (n: number) =>
      Array.from({ length: n }, () => renderHook(({ lat, lon }: { lat: number; lon: number }) => useVehicleMotion(lat, lon), { initialProps: A }));
    /** The region value a hook's marker shows (where it was last set). */
    const valueOf = (h: { result: { current: { coordinate: unknown } } }) => (h.result.current.coordinate as FakeRegion).value as { latitude: number; longitude: number };

    beforeEach(() => {
      jest.useFakeTimers();
      running = 0;
      (Platform as { OS: string }).OS = 'ios';
      maps.AnimatedRegion = FakeRegion;
      maps.Marker.Animated = maps.Marker;
    });
    afterEach(() => {
      (Platform as { OS: string }).OS = os;
      delete maps.AnimatedRegion;
      delete maps.Marker.Animated;
      jest.useRealTimers();
    });

    it('glides at most MAX_JS_GLIDES markers at once; the rest jump', () => {
      expect(motionMode()).toBe('animated');
      const count = MAX_JS_GLIDES + 20;
      const hooks = mountMany(count);
      recordVehiclePoll(Date.now());
      jest.advanceTimersByTime(5000);
      recordVehiclePoll(Date.now());
      hooks.forEach((h) => h.rerender(B));
      expect(running).toBe(MAX_JS_GLIDES);
      expect(hooks.filter((h) => valueOf(h).latitude === B.lat)).toHaveLength(count - MAX_JS_GLIDES); // set straight to B
      act(() => {
        jest.advanceTimersByTime(VEHICLE_ANIMATION_MS);
      });
      expect(running).toBe(0);
      hooks.forEach((h) => h.unmount());
    });

    it('stops every JS glide when a pan starts and frees their slots', () => {
      const hooks = mountMany(3);
      recordVehiclePoll(Date.now());
      jest.advanceTimersByTime(5000);
      recordVehiclePoll(Date.now());
      hooks.forEach((h) => h.rerender(B));
      expect(running).toBe(3);
      act(() => setMapMoving(true));
      expect(running).toBe(0);
      expect(runningJsGlides(Date.now())).toBe(0);
      hooks.forEach((h) => expect(valueOf(h)).toMatchObject({ latitude: B.lat, longitude: B.lon }));
      hooks.forEach((h) => h.unmount());
    });

    it('frees the glide slot when a gliding marker unmounts', () => {
      const [h] = mountMany(1);
      recordVehiclePoll(Date.now());
      jest.advanceTimersByTime(5000);
      recordVehiclePoll(Date.now());
      h.rerender(B);
      expect(runningJsGlides(Date.now())).toBe(1);
      h.unmount();
      expect(runningJsGlides(Date.now())).toBe(0);
      expect(running).toBe(0);
    });
  });
});
