// Night-navy Google-Maps style (Prussian land, Oxford roads, ink water, muted blue labels). Applies on
// Android; iOS uses `userInterfaceStyle="dark"` on the MapView instead (with its POIs hidden by MapView props).
// Only our own data is drawn as pins: every base-map point of interest (shops, museums, parks, churches, schools,
// hospitals, ...) and every transit station icon / label of the base map is hidden, since we draw our own places and
// stops. Street, area and water names stay readable.
import type { MapStyleElement } from 'react-native-maps';

/** Every Google point-of-interest type, each hidden from the map (labels and icons). */
export const HIDDEN_POI_TYPES = [
  'poi',
  'poi.attraction',
  'poi.business',
  'poi.government',
  'poi.medical',
  'poi.park',
  'poi.place_of_worship',
  'poi.school',
  'poi.sports_complex',
] as const;

/** Base-map transit features hidden too (we draw our own stops and lines). */
export const HIDDEN_TRANSIT_TYPES = ['transit.station', 'transit.station.bus', 'transit.station.rail', 'transit.station.airport', 'transit.line'] as const;

/** Rules that turn off the labels (text and icons) of the given feature types. */
function hideLabels(types: readonly string[]): MapStyleElement[] {
  return types.flatMap((featureType) => [
    { featureType, elementType: 'labels', stylers: [{ visibility: 'off' }] },
    { featureType, elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  ]);
}

export const darkMapStyle: MapStyleElement[] = [
  { elementType: 'geometry', stylers: [{ color: '#001A36' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#7E93B2' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#000814' }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: '#00284D' }] },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#00203F' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#06283F' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#003566' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#001D3D' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#0B467F' }] },
  // Road shields / icons (not the street names) would be more base-map pins.
  { featureType: 'road', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#002B55' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#000814' }] },
  ...hideLabels(HIDDEN_POI_TYPES),
  ...hideLabels(HIDDEN_TRANSIT_TYPES),
];
