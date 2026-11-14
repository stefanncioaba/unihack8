// Timișoara news (PLAN 27): every local news site's Timișoara articles in one list, newest first, the same story
// once. Site chips, word search, endless scroll and pull to refresh; a tap opens the full story on the site.
import { useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { NewsCard } from '@/features/news/NewsCard';
import { useDebounced } from '@/hooks/useDebounced';
import { useNewsList, useNewsSources } from '@/hooks/useNews';
import { Chip } from '@/ui/Chip';
import { Screen } from '@/ui/Screen';
import { ScreenHeader } from '@/ui/ScreenHeader';
import { EmptyState, ErrorState, LoadingState } from '@/ui/States';
import { Text } from '@/ui/Text';
import { SearchField } from '@/ui/TextField';
import { colors, PAGE_MARGIN } from '@/ui/theme';

/** The news list with its filters. */
export default function NewsScreen() {
  const [source, setSource] = useState<string | null>(null);
  const [text, setText] = useState('');
  const q = useDebounced(text.trim(), 300);
  const list = useNewsList(source, q);
  const sources = useNewsSources();
  const items = list.data?.pages.flatMap((p) => p.items) ?? [];
  const down = (sources.data ?? []).filter((s) => !s.available).map((s) => s.name);

  return (
    <Screen padded={false} edges={['top', 'bottom']}>
      <View style={styles.top}>
        <ScreenHeader title="Timișoara news" subtitle="From local news sites · Timișoara only" />
        <SearchField placeholder="Search news" value={text} onChangeText={setText} onClear={() => setText('')} />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll} contentContainerStyle={styles.chips}>
        <Chip label="All sites" selected={source === null} onPress={() => setSource(null)} testID="news-source-all" />
        {(sources.data ?? []).map((s) => (
          <Chip
            key={s.id}
            label={s.name}
            selected={source === s.id}
            disabled={!s.available}
            onPress={() => setSource(source === s.id ? null : s.id)}
            testID={`news-source-${s.id}`}
          />
        ))}
      </ScrollView>
      {down.length > 0 ? (
        <Text variant="caption" tone="muted" style={styles.down} testID="news-sources-down">
          Not reachable right now: {down.join(', ')}
        </Text>
      ) : null}

      {list.isPending ? (
        <LoadingState label="Loading Timișoara news…" />
      ) : list.isError && items.length === 0 ? (
        <ErrorState error={list.error} onRetry={() => list.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState
          icon="newspaper-outline"
          title="No news found"
          message={q ? `No Timișoara article matches “${q}”.` : 'No Timișoara news right now.'}
        />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(n) => n.id}
          renderItem={({ item }) => <NewsCard item={item} />}
          contentContainerStyle={styles.list}
          testID="news-list"
          keyboardShouldPersistTaps="handled"
          onEndReachedThreshold={0.4}
          onEndReached={() => {
            if (list.hasNextPage && !list.isFetchingNextPage) list.fetchNextPage();
          }}
          refreshControl={
            <RefreshControl refreshing={list.isRefetching && !list.isFetchingNextPage} onRefresh={() => list.refetch()} tintColor={colors.signal} />
          }
          ListFooterComponent={list.isFetchingNextPage ? <ActivityIndicator color={colors.signal} style={{ marginVertical: 16 }} /> : null}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { paddingHorizontal: PAGE_MARGIN, paddingBottom: 12 },
  chipsScroll: { flexGrow: 0, flexShrink: 0, height: 38, marginBottom: 4 },
  chips: { gap: 8, paddingHorizontal: PAGE_MARGIN, alignItems: 'center' },
  down: { paddingHorizontal: PAGE_MARGIN, marginBottom: 6 },
  list: { gap: 14, paddingHorizontal: PAGE_MARGIN, paddingTop: 4, paddingBottom: 24, width: '100%', maxWidth: 720, alignSelf: 'center' },
});
