// Transit controls under the Map tab's filter row (PLAN 14.4): a "Transit" on/off chip, then one chip per line.
// Choosing a line shows its live vehicles (refreshed every 10 s) and only the stops it serves.
import { ScrollView, StyleSheet } from 'react-native';

import { useTransitRoutes } from '@/hooks/useTransit';
import { Chip } from '@/ui/Chip';

type Props = {
  transitOn: boolean;
  onToggleTransit: () => void;
  /** The chosen line id, or null for "all stops, no vehicles". */
  line: string | null;
  onSelectLine: (line: string | null) => void;
};

/** Chip row. The line chips only appear (and the line list only loads) while transit is on. */
export function TransitControls({ transitOn, onToggleTransit, line, onSelectLine }: Props) {
  const routes = useTransitRoutes(transitOn);
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row} style={styles.scroll} keyboardShouldPersistTaps="handled">
      <Chip label="Transit" icon="bus-outline" selected={transitOn} onPress={onToggleTransit} style={styles.chip} testID="chip-transit" />
      {transitOn &&
        routes.data?.map((r) => (
          <Chip
            key={r.id}
            label={`Line ${r.name}`}
            selected={line === r.id}
            onPress={() => onSelectLine(line === r.id ? null : r.id)}
            style={styles.chip}
            testID={`chip-line-${r.id}`}
          />
        ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 0, flexShrink: 0, height: 34, marginHorizontal: -16 },
  row: { gap: 8, paddingHorizontal: 16, alignItems: 'center' },
  chip: { backgroundColor: 'rgba(25,26,44,0.92)' },
});
