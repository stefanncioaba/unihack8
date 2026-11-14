// Neighbourhood Pulse: "See what your neighbourhood is doing right now." One live card per Timișoara area.
import { useMemo } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';

import { countByArea } from '@/features/help/groupByArea';
import { NeighbourhoodCard } from '@/features/neighbourhoods/NeighbourhoodCard';
import { useHelpBoard } from '@/hooks/useHelp';
import { useNeighbourhoodPulse } from '@/hooks/useNeighbourhoods';
import { formatTime } from '@/lib/time';
import { Screen } from '@/ui/Screen';
import { ScreenHeader } from '@/ui/ScreenHeader';
import { EmptyState, ErrorState, LoadingState } from '@/ui/States';
import { colors, PAGE_MARGIN } from '@/ui/theme';

/** The area list, busiest first, refreshed every minute and on pull-down. Each card also counts the area's open
 * help requests (one board request, same nearest-centre rule as the Help tab); without it the line is hidden. */
export default function NeighbourhoodPulseScreen() {
  const pulse = useNeighbourhoodPulse();
  const help = useHelpBoard();
  const helpCounts = useMemo(
    () => (pulse.data && help.data ? countByArea(help.data, pulse.data.areas) : null),
    [pulse.data, help.data],
  );
  const subtitle = pulse.data ? `Live · updated ${formatTime(pulse.data.generatedAt)}` : 'What your neighbourhood is doing right now';

  return (
    <Screen padded={false} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <ScreenHeader title="Neighbourhood pulse" subtitle={subtitle} />
      </View>
      {pulse.isPending ? (
        <LoadingState label="Checking the neighbourhoods…" />
      ) : pulse.isError ? (
        <ErrorState error={pulse.error} onRetry={() => pulse.refetch()} />
      ) : pulse.data.areas.length === 0 ? (
        <EmptyState icon="pulse-outline" title="No neighbourhoods" message="Nothing to show right now." />
      ) : (
        <FlatList
          data={pulse.data.areas}
          keyExtractor={(a) => a.id}
          renderItem={({ item }) => <NeighbourhoodCard area={item} helpCount={helpCounts ? (helpCounts[item.id] ?? 0) : undefined} />}
          contentContainerStyle={styles.list}
          testID="pulse-list"
          refreshControl={<RefreshControl refreshing={pulse.isRefetching} onRefresh={() => Promise.all([pulse.refetch(), help.refetch()])} tintColor={colors.signal} />}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: PAGE_MARGIN },
  list: { gap: 14, paddingHorizontal: PAGE_MARGIN, paddingBottom: 24, width: '100%', maxWidth: 720, alignSelf: 'center' },
});
