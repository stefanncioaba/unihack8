// Neighbourhood Pulse: "See what your neighbourhood is doing right now." One live card per Timișoara area.
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';

import { NeighbourhoodCard } from '@/features/neighbourhoods/NeighbourhoodCard';
import { useNeighbourhoodPulse } from '@/hooks/useNeighbourhoods';
import { formatTime } from '@/lib/time';
import { Screen } from '@/ui/Screen';
import { ScreenHeader } from '@/ui/ScreenHeader';
import { EmptyState, ErrorState, LoadingState } from '@/ui/States';
import { colors, PAGE_MARGIN } from '@/ui/theme';

/** The area list, busiest first, refreshed every minute and on pull-down. */
export default function NeighbourhoodPulseScreen() {
  const pulse = useNeighbourhoodPulse();
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
          renderItem={({ item }) => <NeighbourhoodCard area={item} />}
          contentContainerStyle={styles.list}
          testID="pulse-list"
          refreshControl={<RefreshControl refreshing={pulse.isRefetching} onRefresh={() => pulse.refetch()} tintColor={colors.signal} />}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: PAGE_MARGIN },
  list: { gap: 14, paddingHorizontal: PAGE_MARGIN, paddingBottom: 24, width: '100%', maxWidth: 720, alignSelf: 'center' },
});
