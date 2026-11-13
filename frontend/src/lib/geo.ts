// Shared geographic constants and helpers.

export type Coordinates = { lat: number; lon: number };

/** Piața Victoriei, Timișoara: used whenever the user's position is unknown. */
export const DEFAULT_POSITION: Coordinates = { lat: 45.7537, lon: 21.2257 };

/** Builds a map region (centre + zoom) around a point. */
export function regionFor(point: Coordinates, delta = 0.035) {
  return { latitude: point.lat, longitude: point.lon, latitudeDelta: delta, longitudeDelta: delta };
}

/** True when both numbers are valid latitude / longitude values. */
export function isValidCoordinate(lat: number, lon: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;
}

/** Formats a point as `lat,lon` for the `near` query parameter. */
export function toNearParam(point: Coordinates): string {
  return `${point.lat.toFixed(5)},${point.lon.toFixed(5)}`;
}
