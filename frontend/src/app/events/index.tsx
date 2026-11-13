// "All events": search box, category and date filters, endless scroll (PLAN 13.3).
import { useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { EVENT_CATEGORIES, type EventCategory } from '@/api/types';
import { CATEGORY_META } from '@/features/events/categories';
import { EventListItem } from '@/features/events/EventCards';
import { useInfiniteEvents } from '@/hooks/queries';
import { useDebounced } from '@/hooks/useDebounced';
import { DATE_PRESETS, dateRangeFor, type DatePreset } from '@/lib/time';
import { Chip } from '@/ui/Chip';
import { Screen } from '@/ui/Screen';
import { ScreenHeader } from '@/ui/ScreenHeader';
import { EmptyState, ErrorState, LoadingState } from '@/ui/States';
import { colors, PAGE_MARGIN } from '@/ui/theme';
import { SearchField } from '@/ui/TextField';

/** Searchable, filterable list of every upcoming event. */
export default function AllEventsScreen() {
  const params = useLocalSearchParams<{ category?: string; focus?: string }>();
  const [text, setText] = useState('');
  const [categories, setCategories] = useState<EventCategory[]>(
    params.category && EVENT_CATEGORIES.includes(params.category as EventCategory) ? [params.category as EventCategory] : [],
  );
  const [preset, setPreset] = useState<DatePreset>('ANY');
  const q = useDebounced(text.trim(), 300);

  // Recomputed only when the date chip changes, so the query key stays stable between renders.
  const range = useMemo(() => dateRangeFor(preset), [preset]);
  const query = useEventsQuery(q, categories, range);
  const items = query.data?.pages.flatMap((p) => p.items) ?? [];

  /** Adds or removes a category from the filter. */
  function toggle(c: EventCategory) {
    setCategories((current) => (current.includes(c) ? current.filter((x) => x !== c) : [...current, c]));
  }

  return (
    <Screen padded={false} edges={['top', 'bottom']}>
      <View style={styles.top}>
        <ScreenHeader title="All events" />
        <SearchField
          placeholder="Search events"
          value={text}
          onChangeText={setText}
          onClear={() => setText('')}
          autoFocus={params.focus === '1'}
        />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll} contentContainerStyle={styles.chips}>
        {EVENT_CATEGORIES.map((c) => (
          <Chip key={c} label={CATEGORY_META[c].label} icon={CATEGORY_META[c].icon} selected={categories.includes(c)} onPress={() => toggle(c)} />
        ))}
      </ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll} contentContainerStyle={styles.chips}>
        {DATE_PRESETS.map((d) => (
          <Chip key={d.key} label={d.label} selected={preset === d.key} onPress={() => setPreset(d.key)} />
        ))}
      </ScrollView>

      {query.isPending ? (
        <LoadingState label="Loading events…" />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : (
        <FlatList
          testID="events-list"
          data={items}
          keyExtractor={(e) => e.id}
          renderItem={({ item }) => <EventListItem event={item} />}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          onEndReachedThreshold={0.4}
          onEndReached={() => {
            if (query.hasNextPage && !query.isFetchingNextPage) query.fetchNextPage();
          }}
          refreshControl={<RefreshControl refreshing={query.isRefetching && !query.isFetchingNextPage} onRefresh={() => query.refetch()} tintColor={colors.teal} />}
          ListEmptyComponent={
            <EmptyState icon="search-outline" title="No events found" message="Try a different search, category or date." />
          }
          ListFooterComponent={query.isFetchingNextPage ? <ActivityIndicator color={colors.teal} style={{ marginVertical: 16 }} /> : null}
        />
      )}
    </Screen>
  );
}

/** Builds the infinite query from the screen's filters. */
function useEventsQuery(q: string, categories: EventCategory[], range: { from?: string; to?: string }) {
  return useInfiniteEvents({ q: q || undefined, category: categories.length ? categories : undefined, from: range.from, to: range.to });
}

const styles = StyleSheet.create({
  top: { paddingHorizontal: PAGE_MARGIN, paddingBottom: 12 },
  // Fixed height + no shrinking, so the rows are never clipped when the keyboard is open.
  chipsScroll: { flexGrow: 0, flexShrink: 0, height: 30, marginBottom: 10 },
  chips: { gap: 8, paddingHorizontal: PAGE_MARGIN },
  list: { paddingHorizontal: PAGE_MARGIN, paddingTop: 4, paddingBottom: 24 },
});
