// Neighbour Help Board: "Neighbours helping neighbours, with trust built in." Open requests nearby, grouped by
// neighbourhood (your area first), and my own (PLAN 25).
import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, RefreshControl, ScrollView, SectionList, StyleSheet, View } from 'react-native';

import { HELP_CATEGORIES, type HelpCategory, type HelpRequestSummary } from '@/api/types.help';
import { HELP_CATEGORY_META } from '@/features/help/categories';
import { filterByCategory } from '@/features/help/format';
import { groupByNeighbourhood } from '@/features/help/groupByArea';
import { HelpRequestRow } from '@/features/help/HelpCards';
import { useCurrentPosition } from '@/features/location/LocationProvider';
import { useHelpBoard, useMyHelpRequests } from '@/hooks/useHelp';
import { useNeighbourhoodPulse } from '@/hooks/useNeighbourhoods';
import { Button } from '@/ui/Button';
import { Chip } from '@/ui/Chip';
import { Screen } from '@/ui/Screen';
import { ScreenHeader } from '@/ui/ScreenHeader';
import { EmptyState, ErrorState, LoadingState } from '@/ui/States';
import { Text } from '@/ui/Text';
import { colors, PAGE_MARGIN } from '@/ui/theme';

type Tab = 'BOARD' | 'MINE';

/** The board with category filters and a "Mine" tab. */
export default function HelpBoardScreen() {
  const [tab, setTab] = useState<Tab>('BOARD');
  const [categories, setCategories] = useState<HelpCategory[]>([]);

  /** Adds or removes a category from the filter. */
  function toggle(c: HelpCategory) {
    setCategories((current) => (current.includes(c) ? current.filter((x) => x !== c) : [...current, c]));
  }

  return (
    <Screen padded={false} edges={['top', 'bottom']}>
      <View style={styles.top}>
        <ScreenHeader title="Help board" subtitle="Neighbours helping neighbours, with trust built in" />
        <View style={styles.tabs}>
          <Chip label="Nearby" icon="location-outline" selected={tab === 'BOARD'} onPress={() => setTab('BOARD')} />
          <Chip label="Mine" icon="person-outline" selected={tab === 'MINE'} onPress={() => setTab('MINE')} />
        </View>
      </View>

      {tab === 'BOARD' && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll} contentContainerStyle={styles.chips}>
          {HELP_CATEGORIES.map((c) => (
            <Chip key={c} label={HELP_CATEGORY_META[c].label} icon={HELP_CATEGORY_META[c].icon} selected={categories.includes(c)} onPress={() => toggle(c)} />
          ))}
        </ScrollView>
      )}

      <View style={{ flex: 1 }}>{tab === 'BOARD' ? <Board categories={categories} /> : <Mine />}</View>

      <View style={styles.cta}>
        <Button title="Ask for help" icon="add" iconLeft onPress={() => router.push('/help/new')} />
      </View>
    </Screen>
  );
}

/** Open requests (filtered), one section per neighbourhood with yours first; refreshed every 30 s and on pull-down.
 * If the neighbourhoods fail to load it is one flat list, closest first. */
function Board({ categories }: { categories: HelpCategory[] }) {
  const board = useHelpBoard();
  const pulse = useNeighbourhoodPulse();
  const { position, isFallback } = useCurrentPosition();
  // Waits for the neighbourhoods too, so the list does not jump from flat to grouped.
  if (board.isPending || pulse.isPending) return <LoadingState label="Loading requests…" />;
  if (board.isError) return <ErrorState error={board.error} onRetry={() => board.refetch()} />;
  const items = filterByCategory(board.data, categories);
  const refresh = <RefreshControl refreshing={board.isRefetching} onRefresh={() => board.refetch()} tintColor={colors.signal} />;
  const empty =
    categories.length > 0 ? (
      <EmptyState icon="search-outline" title="Nothing in these categories" message="Try another category, or ask for help yourself." />
    ) : (
      <EmptyState icon="hand-left-outline" title="Nobody needs help right now" message="Need a hand yourself? Ask your neighbours." />
    );

  const areas = pulse.data?.areas ?? [];
  if (areas.length === 0) {
    return (
      <FlatList
        testID="help-list"
        data={items}
        keyExtractor={(r) => r.id}
        renderItem={({ item }) => <HelpRequestRow request={item} />}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        contentContainerStyle={styles.list}
        refreshControl={refresh}
        ListEmptyComponent={empty}
      />
    );
  }

  const sections = groupByNeighbourhood(items, areas, isFallback ? null : position);
  return (
    <SectionList
      testID="help-list"
      sections={sections}
      keyExtractor={(r) => r.id}
      renderItem={({ item }) => <HelpRequestRow request={item} />}
      renderSectionHeader={({ section }) => (
        <View style={styles.areaHeader} testID={`help-area-${section.key}`} accessibilityRole="header">
          <Text variant="heading">
            {section.title} ({section.data.length})
          </Text>
          {section.isHere ? (
            <Text variant="chip" style={{ color: colors.signal }}>
              {"YOU'RE HERE"}
            </Text>
          ) : null}
        </View>
      )}
      ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
      stickySectionHeadersEnabled={false}
      // The open board is short: draw it in one pass instead of growing after the first 10 rows.
      initialNumToRender={30}
      contentContainerStyle={styles.list}
      refreshControl={refresh}
      ListEmptyComponent={empty}
    />
  );
}

/** My own requests and the ones I offered on, in every status. */
function Mine() {
  const mine = useMyHelpRequests();
  if (mine.isPending) return <LoadingState label="Loading your requests…" />;
  if (mine.isError) return <ErrorState error={mine.error} onRetry={() => mine.refetch()} />;
  const { requested, offered } = mine.data;
  return (
    <ScrollView
      testID="help-mine"
      contentContainerStyle={styles.list}
      refreshControl={<RefreshControl refreshing={mine.isRefetching} onRefresh={() => mine.refetch()} tintColor={colors.signal} />}
    >
      <Section title="You asked" empty="You have not asked for help yet." items={requested} showRequester={false} />
      <Section title="You offered" empty="You have not offered to help yet." items={offered} showRequester />
    </ScrollView>
  );
}

/** A titled group of request rows with an empty line. */
function Section({ title, empty, items, showRequester }: { title: string; empty: string; items: HelpRequestSummary[]; showRequester: boolean }) {
  return (
    <View style={styles.section}>
      <Text variant="heading" accessibilityRole="header">
        {title} ({items.length})
      </Text>
      {items.length === 0 ? (
        <Text tone="muted">{empty}</Text>
      ) : (
        items.map((r) => <HelpRequestRow key={r.id} request={r} showRequester={showRequester} />)
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  top: { paddingHorizontal: PAGE_MARGIN },
  tabs: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  chipsScroll: { flexGrow: 0, flexShrink: 0, height: 38, marginBottom: 6 },
  chips: { gap: 8, paddingHorizontal: PAGE_MARGIN, alignItems: 'center' },
  list: { paddingHorizontal: PAGE_MARGIN, paddingTop: 4, paddingBottom: 16, gap: 0, width: '100%', maxWidth: 720, alignSelf: 'center' },
  section: { gap: 10, marginBottom: 18 },
  areaHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 14, paddingBottom: 8, backgroundColor: colors.bg },
  cta: { paddingHorizontal: PAGE_MARGIN, paddingTop: 8, paddingBottom: 8, width: '100%', maxWidth: 720, alignSelf: 'center' },
});
