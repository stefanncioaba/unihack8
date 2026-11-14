// Smooth vehicle movement, as on live.stpt.ro: positions are polled every 5 s and each vehicle glides linearly from
// its previous to its new position over about 4.8 s. It jumps instead when the previous update is too old (> 12 s,
// e.g. the app was in the background), when the jump is unrealistically long (> 1 km) or while the map is being
// panned / zoomed. Pure helpers (interpolation, the snap rule) plus two tiny module stores: the time of the last
// vehicle polls and whether the map is moving. No React here.
import { distanceMeters, type Coordinates } from '@/lib/geo';

/** How long one glide takes (a little under the 5 s poll, so a vehicle arrives before its next position). */
export const VEHICLE_ANIMATION_MS = 4800;
/** Gap between two updates above which a vehicle jumps to its new position instead of gliding. */
export const SNAP_AFTER_MS = 12_000;
/** A move longer than this is not a real drive between two polls: jump. */
export const SNAP_JUMP_METERS = 1000;

/** One glide: from where the marker was to the new position, starting at `start` (ms) for `duration` ms. A jump is a
 * glide of duration 0. */
export type VehicleMove = { from: Coordinates; to: Coordinates; start: number; duration: number };

/** What to do with a new position. */
export type MovePlan = { kind: 'none' } | { kind: 'snap' } | { kind: 'animate'; duration: number };

/** The point a fraction `t` (clamped to 0..1) of the way from `a` to `b` (linear; fine over a few hundred metres). */
export function lerpCoord(a: Coordinates, b: Coordinates, t: number): Coordinates {
  const f = Math.min(1, Math.max(0, Number.isFinite(t) ? t : 1));
  return { lat: a.lat + (b.lat - a.lat) * f, lon: a.lon + (b.lon - a.lon) * f };
}

/** Where a marker is at `now` during (or after) a glide. */
export function positionAt(move: VehicleMove, now: number): Coordinates {
  if (move.duration <= 0) return move.to;
  return lerpCoord(move.from, move.to, (now - move.start) / move.duration);
}

/** A marker standing still at a point (its first position). */
export function stillAt(point: Coordinates, now: number): VehicleMove {
  return { from: point, to: point, start: now, duration: 0 };
}

/** True while a glide is still running at `now`. */
export function isGliding(move: VehicleMove, now: number): boolean {
  return move.duration > 0 && now < move.start + move.duration;
}

/** The snap rule. `shown` is where the marker is now, `target` the new position, `gapMs` the time since the update
 * before this one, `mapMoving` true while the user pans / zooms. Same place: nothing to do; otherwise jump when the
 * gap is over SNAP_AFTER_MS, the move is over SNAP_JUMP_METERS or the map is moving; else glide for
 * VEHICLE_ANIMATION_MS. */
export function planMove(shown: Coordinates, target: Coordinates, gapMs: number, mapMoving: boolean): MovePlan {
  if (shown.lat === target.lat && shown.lon === target.lon) return { kind: 'none' };
  if (mapMoving || !Number.isFinite(gapMs) || gapMs > SNAP_AFTER_MS) return { kind: 'snap' };
  if (distanceMeters(shown, target) > SNAP_JUMP_METERS) return { kind: 'snap' };
  return { kind: 'animate', duration: VEHICLE_ANIMATION_MS };
}

/** One animation frame (ms): a jump sent during a native glide lasts this much longer than the glide's rest. */
export const FRAME_MS = 16;

/** Duration of the command that jumps a native (Android) marker. Android cannot cancel a running marker animator (each
 * animateMarkerToCoordinate starts a new one), so while a glide still runs at `now` the jump must end after it, or the
 * old animator would write its stale target last: the rest of the glide plus one frame. 0 when nothing glides. */
export function jumpDurationMs(move: VehicleMove, now: number): number {
  return isGliding(move, now) ? move.start + move.duration - now + FRAME_MS : 0;
}

/** Most markers gliding at once with a JS-driven animation (iOS AnimatedRegion, one JS update per marker per frame).
 * Beyond it a marker jumps instead, so a zoomed-out overview of the whole fleet never runs hundreds of them. */
export const MAX_JS_GLIDES = 30;
// Running JS glides: owner (one per marker) -> end time (ms).
const jsGlides = new Map<object, number>();

/** Asks for one of the MAX_JS_GLIDES slots for a glide of `duration` ms from `now`; false when all are taken. The
 * owner's own previous glide never counts against it. */
export function claimJsGlide(owner: object, now: number, duration: number, max: number = MAX_JS_GLIDES): boolean {
  for (const [key, end] of jsGlides) if (end <= now) jsGlides.delete(key);
  jsGlides.delete(owner);
  if (jsGlides.size >= max) return false;
  jsGlides.set(owner, now + duration);
  return true;
}

/** Frees the owner's slot (its glide stopped early, or the marker went away). */
export function releaseJsGlide(owner: object): void {
  jsGlides.delete(owner);
}

/** How many JS glides are running at `now`. */
export function runningJsGlides(now: number): number {
  let n = 0;
  for (const end of jsGlides.values()) if (end > now) n += 1;
  return n;
}

/** Forgets every JS glide (tests). */
export function resetJsGlides(): void {
  jsGlides.clear();
}

/** Polls closer together than this (several vehicle queries answering at once) count as one update. */
const SAME_POLL_MS = 1500;
// The last two distinct vehicle update times (ms).
let lastPollAt = Number.NaN;
let previousPollAt = Number.NaN;

/** Notes that fresh vehicle positions arrived (called by the vehicle queries). */
export function recordVehiclePoll(at: number = Date.now()): void {
  if (Number.isFinite(lastPollAt) && at - lastPollAt < SAME_POLL_MS) return;
  previousPollAt = lastPollAt;
  lastPollAt = at;
}

/** Time between the latest vehicle update and the one before it (Infinity before the second update, so the first
 * positions never glide). */
export function vehiclePollGapMs(): number {
  return Number.isFinite(previousPollAt) && Number.isFinite(lastPollAt) ? lastPollAt - previousPollAt : Infinity;
}

/** Forgets the poll times (tests). */
export function resetVehiclePolls(): void {
  lastPollAt = Number.NaN;
  previousPollAt = Number.NaN;
}

// Whether the user is panning / zooming the map, and who wants to know when that starts.
let mapMoving = false;
const motionListeners = new Set<() => void>();

/** Called by the map: true on every camera move, false when it settles. Listeners hear only the start of a move. */
export function setMapMoving(moving: boolean): void {
  if (moving === mapMoving) return;
  mapMoving = moving;
  if (moving) motionListeners.forEach((l) => l());
}

/** True while the map is being panned / zoomed. */
export function isMapMoving(): boolean {
  return mapMoving;
}

/** Calls `listener` when a pan / zoom starts (markers finish their glide at once); returns an unsubscribe. */
export function onMapMoveStart(listener: () => void): () => void {
  motionListeners.add(listener);
  return () => {
    motionListeners.delete(listener);
  };
}

/** Bearing steps the marker arrow snaps to, so a vehicle turning slightly does not redraw its marker. */
export const BEARING_STEP = 15;

/** A bearing (degrees from north, clockwise) rounded to BEARING_STEP in 0..359, or null when unknown. */
export function bearingStep(bearing: number | null | undefined): number | null {
  if (bearing === null || bearing === undefined || !Number.isFinite(bearing)) return null;
  const b = ((bearing % 360) + 360) % 360;
  return (Math.round(b / BEARING_STEP) * BEARING_STEP) % 360;
}

/** The three corners ("x,y x,y x,y", SVG points) of the small bearing arrow around a marker centred at (cx, cy): its
 * tip `tip` px from the centre in the bearing direction, its base `base` px out and `halfWidth` px to each side. */
export function arrowPoints(bearing: number, cx: number, cy: number, base: number, tip: number, halfWidth: number): string {
  const r = (bearing * Math.PI) / 180;
  const [dx, dy] = [Math.sin(r), -Math.cos(r)]; // screen y grows downwards; 0° points up
  const [px, py] = [Math.cos(r), Math.sin(r)]; // perpendicular
  const round = (n: number) => Math.round(n * 10) / 10;
  const pt = (x: number, y: number) => `${round(x)},${round(y)}`;
  const [bx, by] = [cx + dx * base, cy + dy * base];
  return [pt(cx + dx * tip, cy + dy * tip), pt(bx + px * halfWidth, by + py * halfWidth), pt(bx - px * halfWidth, by - py * halfWidth)].join(' ');
}
