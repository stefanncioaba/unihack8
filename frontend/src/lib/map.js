export const TIMISOARA_CENTER = Object.freeze({ latitude: 45.7489, longitude: 21.2087 });

// Builds a safe map region around a geographic point.
export function regionForCoordinates(latitude, longitude) {
  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    Math.abs(latitude) > 90 ||
    Math.abs(longitude) > 180
  ) {
    throw new RangeError('Invalid map coordinates');
  }

  return { latitude, longitude, latitudeDelta: 0.035, longitudeDelta: 0.035 };
}
