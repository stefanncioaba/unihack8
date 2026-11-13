// Display data for place categories on the map (labels and icons). The list itself comes from the API (PLAN 8.1).
import type { PlaceCategory } from '@/api/types.places';
import type { IconName } from '@/ui/Icon';

export const PLACE_META: Record<PlaceCategory, { label: string; icon: IconName }> = {
  restaurant: { label: 'Restaurants', icon: 'restaurant-outline' },
  cafe: { label: 'Cafés', icon: 'cafe-outline' },
  bar: { label: 'Bars', icon: 'beer-outline' },
  fast_food: { label: 'Fast food', icon: 'fast-food-outline' },
  club: { label: 'Clubs', icon: 'musical-notes-outline' },
  pharmacy: { label: 'Pharmacies', icon: 'medkit-outline' },
  supermarket: { label: 'Supermarkets', icon: 'cart-outline' },
  park: { label: 'Parks', icon: 'leaf-outline' },
  attraction: { label: 'Sights', icon: 'camera-outline' },
  atm: { label: 'ATMs', icon: 'card-outline' },
};

/** Meta for a category, tolerating unknown values from a newer backend. */
export function placeMeta(category: string): { label: string; icon: IconName } {
  return PLACE_META[category as PlaceCategory] ?? { label: category, icon: 'location-outline' };
}
