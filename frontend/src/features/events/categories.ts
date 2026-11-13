// Display data for event categories: label, icon and the gradient used when an event has no image.
import type { EventCategory } from '@/api/types';
import type { IconName } from '@/ui/Icon';

export type CategoryMeta = { label: string; icon: IconName; colors: [string, string] };

export const CATEGORY_META: Record<EventCategory, CategoryMeta> = {
  PARTY: { label: 'Party', icon: 'sparkles-outline', colors: ['#4A1D7A', '#111029'] },
  CONCERT: { label: 'Concert', icon: 'musical-notes-outline', colors: ['#0B5560', '#3A1766'] },
  THEATRE: { label: 'Theatre', icon: 'film-outline', colors: ['#7A3418', '#3A1766'] },
  SPORT: { label: 'Sport', icon: 'football-outline', colors: ['#0B5560', '#111029'] },
  GAMES: { label: 'Games', icon: 'game-controller-outline', colors: ['#3A1766', '#0B5560'] },
  FOOD: { label: 'Food', icon: 'restaurant-outline', colors: ['#7A3418', '#111029'] },
  ART: { label: 'Art', icon: 'color-palette-outline', colors: ['#4A1D7A', '#7A3418'] },
  MEETUP: { label: 'Meetup', icon: 'people-outline', colors: ['#0B5560', '#1B2A4A'] },
  OTHER: { label: 'Other', icon: 'calendar-outline', colors: ['#252536', '#111029'] },
};

/** Meta for a category, tolerating unknown values from newer backends. */
export function categoryMeta(category: string): CategoryMeta {
  return CATEGORY_META[category as EventCategory] ?? CATEGORY_META.OTHER;
}
