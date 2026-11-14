// Night-navy Google-Maps style (Prussian land, Oxford roads, ink water, muted blue labels). Applies on
// Android; iOS uses `userInterfaceStyle="dark"` on the MapView instead.
import type { MapStyleElement } from 'react-native-maps';

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
  { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#002B55' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#000814' }] },
];
