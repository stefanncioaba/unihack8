// Top chip row of the Map tab: the Events toggle and the place category filters (PLAN 14.2, 14.3).
import { ScrollView, StyleSheet } from 'react-native';

import { PLACE_CATEGORIES, type PlaceCategory } from '@/api/types.places';
import { Chip } from '@/ui/Chip';
import { PLACE_META } from './placeCategories';

type Props = {
  categories: PlaceCategory[];
  onToggleCategory: (category: PlaceCategory) => void;
  onClearCategories: () => void;
  eventsOn: boolean;
  onToggleEvents: () => void;
};

/** Horizontal chips: "Events" on/off, "All places", then one chip per category (multi-select). */
export function MapFilterBar({ categories, onToggleCategory, onClearCategories, eventsOn, onToggleEvents }: Props) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row} style={styles.scroll} keyboardShouldPersistTaps="handled">
      <Chip label="Events" icon="calendar-outline" selected={eventsOn} onPress={onToggleEvents} style={styles.chip} testID="chip-events" />
      <Chip label="All places" selected={categories.length === 0} onPress={onClearCategories} style={styles.chip} />
      {PLACE_CATEGORIES.map((c) => (
        <Chip key={c} label={PLACE_META[c].label} icon={PLACE_META[c].icon} selected={categories.includes(c)} onPress={() => onToggleCategory(c)} style={styles.chip} />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 0, flexShrink: 0, height: 34, marginHorizontal: -16 },
  row: { gap: 8, paddingHorizontal: 16, alignItems: 'center' },
  // Dark translucent fill so the chips stay readable over the map.
  chip: { backgroundColor: 'rgba(25,26,44,0.92)' },
});
