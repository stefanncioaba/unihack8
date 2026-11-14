// Display data for help request categories: label, icon and a one-line hint for the create form.
import type { HelpCategory } from '@/api/types.help';
import type { IconName } from '@/ui/Icon';

export type HelpCategoryMeta = { label: string; icon: IconName; hint: string };

export const HELP_CATEGORY_META: Record<HelpCategory, HelpCategoryMeta> = {
  BORROW: { label: 'Borrow', icon: 'hammer-outline', hint: 'Lend a tool or a thing' },
  CARRY: { label: 'Carry', icon: 'cube-outline', hint: 'Carry or move something' },
  PETS: { label: 'Pets', icon: 'paw-outline', hint: 'Walk or feed a pet' },
  ERRANDS: { label: 'Errands', icon: 'bag-handle-outline', hint: 'Shopping, pick-ups' },
  REPAIRS: { label: 'Repairs', icon: 'build-outline', hint: 'Small fixes, tech help' },
  OTHER: { label: 'Other', icon: 'hand-left-outline', hint: 'Anything else small' },
};

/** Meta for a category, tolerating unknown values from newer backends. */
export function helpCategoryMeta(category: string): HelpCategoryMeta {
  return HELP_CATEGORY_META[category as HelpCategory] ?? HELP_CATEGORY_META.OTHER;
}
