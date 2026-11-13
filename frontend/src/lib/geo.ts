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

/** Straight-line distance in metres between two points (haversine). */
export function distanceMeters(a: Coordinates, b: Coordinates): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lon - a.lon) / 2) ** 2;
  return Math.round(2 * 6_371_000 * Math.asin(Math.sqrt(h)));
}
