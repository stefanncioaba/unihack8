// Line chips under the Map tab's filter row (PLAN 14.4), shown while "Transport" is on.
// Choosing a line shows its live vehicles (refreshed every 10 s) and only the stops it serves.
import { ScrollView, StyleSheet } from 'react-native';

import { useTransitRoutes } from '@/hooks/useTransit';
import { Chip } from '@/ui/Chip';

type Props = {
  /** The chosen line id, or null for "all stops, no vehicles". */
  line: string | null;
  onSelectLine: (line: string | null) => void;
};

/** One chip per line; tapping the chosen line again clears it. Renders nothing until the lines have loaded. */
export function TransitControls({ line, onSelectLine }: Props) {
  const routes = useTransitRoutes(true);
  if (!routes.data?.length) return null;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row} style={styles.scroll} keyboardShouldPersistTaps="handled" testID="transit-lines">
      {routes.data.map((r) => (
        <Chip
          key={r.id}
          overMap
          label={`Line ${r.name}`}
          selected={line === r.id}
          onPress={() => onSelectLine(line === r.id ? null : r.id)}
          testID={`chip-line-${r.id}`}
        />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 0, flexShrink: 0, height: 34, marginHorizontal: -16 },
  row: { gap: 8, paddingHorizontal: 16, alignItems: 'center' },
});
