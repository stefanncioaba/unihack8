// Top chip row of the Map tab (PLAN 14.2-14.4): "All places", "Events", "Transport", then the place categories.
// The rules for what each press does live in mapFilters.ts.
import { ScrollView, StyleSheet } from 'react-native';

import { PLACE_CATEGORIES } from '@/api/types.places';
import { Chip } from '@/ui/Chip';
import { allPlacesSelected, categorySelected, type MapFilterAction, type MapFilters } from './mapFilters';
import { PLACE_META } from './placeCategories';

type Props = {
  filters: MapFilters;
  onChange: (action: MapFilterAction) => void;
  /** All chips greyed out and not pressable (while directions are shown). */
  disabled?: boolean;
};

/** Horizontal chips: the three layer chips first, then one chip per place category (multi-select). */
export function MapFilterBar({ filters, onChange, disabled = false }: Props) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row} style={styles.scroll} keyboardShouldPersistTaps="handled" testID="map-filter-bar">
      <Chip overMap disabled={disabled} label="All places" icon="location-outline" selected={allPlacesSelected(filters)} onPress={() => onChange({ type: 'allPlaces' })} testID="chip-places" />
      <Chip overMap disabled={disabled} label="Events" icon="calendar-outline" selected={filters.eventsOn} onPress={() => onChange({ type: 'events' })} testID="chip-events" />
      <Chip overMap disabled={disabled} label="Transport" icon="bus-outline" selected={filters.transitOn} onPress={() => onChange({ type: 'transport' })} testID="chip-transit" />
      {PLACE_CATEGORIES.map((c) => (
        <Chip
          key={c}
          overMap
          disabled={disabled}
          label={PLACE_META[c].label}
          icon={PLACE_META[c].icon}
          selected={categorySelected(filters, c)}
          onPress={() => onChange({ type: 'category', category: c })}
          testID={`chip-category-${c}`}
        />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 0, flexShrink: 0, height: 34, marginHorizontal: -16 },
  row: { gap: 8, paddingHorizontal: 16, alignItems: 'center' },
});
