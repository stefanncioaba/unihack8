// Display data for event categories: label, icon and the gradient used when an event has no image.
import type { EventCategory } from '@/api/types';
import type { IconName } from '@/ui/Icon';

export type CategoryMeta = { label: string; icon: IconName; colors: [string, string] };

export const CATEGORY_META: Record<EventCategory, CategoryMeta> = {
  PARTY: { label: 'Party', icon: 'sparkles-outline', colors: ['#003566', '#000814'] },
  CONCERT: { label: 'Concert', icon: 'musical-notes-outline', colors: ['#0B467F', '#001D3D'] },
  THEATRE: { label: 'Theatre', icon: 'film-outline', colors: ['#5C4400', '#001D3D'] },
  SPORT: { label: 'Sport', icon: 'football-outline', colors: ['#003566', '#001D3D'] },
  GAMES: { label: 'Games', icon: 'game-controller-outline', colors: ['#00284D', '#0B467F'] },
  FOOD: { label: 'Food', icon: 'restaurant-outline', colors: ['#6B5200', '#000814'] },
  ART: { label: 'Art', icon: 'color-palette-outline', colors: ['#0B467F', '#5C4400'] },
  MEETUP: { label: 'Meetup', icon: 'people-outline', colors: ['#003566', '#00284D'] },
  OTHER: { label: 'Other', icon: 'calendar-outline', colors: ['#00284D', '#000814'] },
};

/** Meta for a category, tolerating unknown values from newer backends. */
export function categoryMeta(category: string): CategoryMeta {
  return CATEGORY_META[category as EventCategory] ?? CATEGORY_META.OTHER;
}
