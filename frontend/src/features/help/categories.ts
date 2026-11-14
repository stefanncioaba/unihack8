// Display data for help request categories: label, icon and a one-line hint for the create form.
import type { HelpCategory } from '@/api/types.help';
import type { IconName } from '@/ui/Icon';

export type HelpCategoryMeta = { label: string; icon: IconName; hint: string };

export const HELP_CATEGORY_META: Record<HelpCategory, HelpCategoryMeta> = {
  BORROW: { label: 'Borrow', icon: 'hammer-outline', hint: 'Lend a tool or a thing' },
  CARRY: { label: 'Carry', icon: 'cube-outline', hint: 'Carry or move something' },
  PETS: { label: 'Pets', icon: 'paw-outline', hint: 'Walk or feed a pet' },
  ERRANDS: { label: 'Errands', icon: 'bag-handle-outline', hint: 'Shopping, pick-ups' },
  REPAIRS: { label: 'Repairs', icon: 'build-outline', hint: 'Small fixes around the home' },
  CARPENTRY: { label: 'Carpentry', icon: 'hammer-outline', hint: 'Furniture, shelves, wood' },
  PLUMBING: { label: 'Plumbing', icon: 'water-outline', hint: 'Taps, drains, leaks' },
  ELECTRICAL: { label: 'Electrical', icon: 'flash-outline', hint: 'Lights, sockets, appliances' },
  PAINTING: { label: 'Painting', icon: 'brush-outline', hint: 'Walls, doors, touch-ups' },
  GARDENING: { label: 'Gardening', icon: 'leaf-outline', hint: 'Plants, yard, balcony' },
  CLEANING: { label: 'Cleaning', icon: 'sparkles-outline', hint: 'Tidy up, clear out' },
  TECH: { label: 'Tech', icon: 'laptop-outline', hint: 'Phones, computers, Wi-Fi' },
  TUTORING: { label: 'Tutoring', icon: 'school-outline', hint: 'Homework, languages, lessons' },
  COOKING: { label: 'Cooking', icon: 'restaurant-outline', hint: 'Cook a meal, share a recipe' },
  BIKES: { label: 'Bikes', icon: 'bicycle-outline', hint: 'Fix or tune a bike' },
  CARS: { label: 'Cars', icon: 'car-outline', hint: 'Jump-start, tyres, a lift' },
  ELDERLY: { label: 'Elderly care', icon: 'heart-outline', hint: 'Keep an older neighbour company' },
  OTHER: { label: 'Other', icon: 'hand-left-outline', hint: 'Anything else small' },
};

/** Meta for a category, tolerating unknown values from newer backends. */
export function helpCategoryMeta(category: string): HelpCategoryMeta {
  return HELP_CATEGORY_META[category as HelpCategory] ?? HELP_CATEGORY_META.OTHER;
}
