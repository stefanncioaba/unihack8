// Small display formatters.

/** `420 m` below one kilometre, `1.4 km` above. */
export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}
