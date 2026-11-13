// Dark, desaturated Google-Maps style (navy land, charcoal roads, dark teal water). Applies on Android;
// iOS uses `userInterfaceStyle="dark"` on the MapView instead.
import type { MapStyleElement } from 'react-native-maps';

export const darkMapStyle: MapStyleElement[] = [
  { elementType: 'geometry', stylers: [{ color: '#111029' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8E8CA3' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#090A18' }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: '#252536' }] },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#151530' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#10223A' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#252536' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#191A2C' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#2F3350' }] },
  { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#1D2140' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0B3C45' }] },
];
