// Google encoded polylines (the format OpenTripPlanner returns, see docs/API.md -> Routing).
// Own implementation of the published algorithm: 5 decimal places, zig-zag signed deltas, 5-bit chunks + 63.
import type { Coordinates } from './geo';

/** Turns an encoded polyline into points. Stops at the first malformed chunk instead of throwing. */
export function decodePolyline(encoded: string): Coordinates[] {
  const points: Coordinates[] = [];
  let index = 0;
  let lat = 0;
  let lon = 0;

  /** Reads one signed delta, or null when the string ends mid-value. */
  function next(): number | null {
    let result = 0;
    let shift = 0;
    let byte: number;
    do {
      if (index >= encoded.length) return null;
      byte = encoded.charCodeAt(index++) - 63;
      if (byte < 0) return null;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    return result & 1 ? ~(result >> 1) : result >> 1;
  }

  while (index < encoded.length) {
    const dLat = next();
    const dLon = next();
    if (dLat === null || dLon === null) break;
    lat += dLat;
    lon += dLon;
    points.push({ lat: lat / 1e5, lon: lon / 1e5 });
  }
  return points;
}

/** Encodes points as a polyline (used by the mock route planner and tests). */
export function encodePolyline(points: Coordinates[]): string {
  let out = '';
  let prevLat = 0;
  let prevLon = 0;

  /** Appends one signed value. */
  function put(value: number) {
    let v = value < 0 ? ~(value << 1) : value << 1;
    while (v >= 0x20) {
      out += String.fromCharCode((0x20 | (v & 0x1f)) + 63);
      v >>= 5;
    }
    out += String.fromCharCode(v + 63);
  }

  for (const p of points) {
    const lat = Math.round(p.lat * 1e5);
    const lon = Math.round(p.lon * 1e5);
    put(lat - prevLat);
    put(lon - prevLon);
    prevLat = lat;
    prevLon = lon;
  }
  return out;
}
