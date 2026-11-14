// Photos of each Timișoara area, from Wikimedia Commons (free licences; credits in assets/neighbourhoods/CREDITS.md).
import type { ImageSourcePropType } from 'react-native';

/** Area id (from the backend) -> bundled photo and its credit line. */
export const NEIGHBOURHOOD_PHOTOS: Record<string, { source: ImageSourcePropType; credit: string }> = {
  cetate: { source: require('../../../assets/neighbourhoods/cetate.jpg'), credit: 'Turbojet, CC BY-SA 4.0' },
  fabric: { source: require('../../../assets/neighbourhoods/fabric.jpg'), credit: 'Chainwit., CC BY 4.0' },
  iosefin: { source: require('../../../assets/neighbourhoods/iosefin.jpg'), credit: 'Turbojet, CC BY-SA 4.0' },
  elisabetin: { source: require('../../../assets/neighbourhoods/elisabetin.jpg'), credit: 'Turbojet, CC BY-SA 3.0' },
  mehala: { source: require('../../../assets/neighbourhoods/mehala.jpg'), credit: 'Auguste, CC BY-SA 4.0' },
  complex: { source: require('../../../assets/neighbourhoods/complex.jpg'), credit: 'LittleT889, CC BY 4.0' },
  circumvalatiunii: { source: require('../../../assets/neighbourhoods/circumvalatiunii.jpg'), credit: 'Radufan, CC BY 2.5' },
  fratelia: { source: require('../../../assets/neighbourhoods/fratelia.jpg'), credit: 'Turbojet, CC BY-SA 3.0' },
  soarelui: { source: require('../../../assets/neighbourhoods/soarelui.jpg'), credit: 'Dan Dobre, CC BY 3.0' },
};

/** The photo for an area, or null for an area the app has no photo for (a newer backend). */
export function neighbourhoodPhoto(id: string) {
  return NEIGHBOURHOOD_PHOTOS[id] ?? null;
}
