// Home tab: header, search, category chips, city info strip, AI shortcuts, upcoming events, create-event button.
import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { EVENT_CATEGORIES, type EventCategory } from '@/api/types';
import { ShortcutBar } from '@/features/ai/ShortcutBar';
import { CATEGORY_META } from '@/features/events/categories';
import { EventCard } from '@/features/events/EventCards';
import { useCurrentPosition } from '@/features/location/LocationProvider';
import { CityInfoStrip } from '@/features/transit/CityInfoStrip';
import { useEventsPage } from '@/hooks/queries';
import { useTransitSummary } from '@/hooks/useTransit';
import { Button } from '@/ui/Button';
import { Chip } from '@/ui/Chip';
import { Icon } from '@/ui/Icon';
import { Screen } from '@/ui/Screen';
import { EmptyState, ErrorState, LoadingState } from '@/ui/States';
import { Text } from '@/ui/Text';
import { SearchField } from '@/ui/TextField';
import { colors, PAGE_MARGIN } from '@/ui/theme';

const HOME_EVENT_COUNT = 8;

/** "Live" with a glowing yellow dot while transit data flows; grey "Offline" when it does not. */
function LivePill({ offline }: { offline: boolean }) {
  return (
    <View style={[styles.live, offline && styles.liveOff]}>
      <View style={[styles.liveDot, offline && { backgroundColor: colors.textMuted }]} />
      <Text variant="chip" style={{ color: offline ? colors.textMuted : colors.gold }}>
        {offline ? 'Offline' : 'Live'}
      </Text>
    </View>
  );
}

/** The discovery-style Home page. */
export default function HomeScreen() {
  const [category, setCategory] = useState<EventCategory | null>(null);
  const { position } = useCurrentPosition();
  const summary = useTransitSummary(position);
  const events = useEventsPage({ category: category ? [category] : undefined, size: HOME_EVENT_COUNT });
  const [refreshing, setRefreshing] = useState(false);

  /** Pull-to-refresh reloads the events and the transit line. */
  async function refresh() {
    setRefreshing(true);
    await Promise.all([events.refetch(), summary.refetch()]);
    setRefreshing(false);
  }

  return (
    <Screen scroll padded={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.signal} />}>
      <View style={styles.header}>
        <Text variant="title" accessibilityRole="header">
          Timișoara
        </Text>
        <View style={styles.headerRight}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Find people"
            onPress={() => router.push('/users/search')}
            style={styles.iconButton}
          >
            <Icon name="people-outline" size={18} />
          </Pressable>
          <LivePill offline={summary.isError} />
        </View>
      </View>

      <View style={styles.block}>
        <SearchField placeholder="Search events" onPressField={() => router.push('/events?focus=1')} />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} style={styles.chipsScroll}>
        <Chip label="All" selected={category === null} onPress={() => setCategory(null)} />
        {EVENT_CATEGORIES.map((c) => (
          <Chip key={c} label={CATEGORY_META[c].label} icon={CATEGORY_META[c].icon} selected={category === c} onPress={() => setCategory(category === c ? null : c)} />
        ))}
      </ScrollView>

      <View style={[styles.block, { paddingHorizontal: PAGE_MARGIN }]}>
        <CityInfoStrip />
      </View>

      <ShortcutBar />

      <View style={[styles.sectionHeader, { paddingHorizontal: PAGE_MARGIN }]}>
        <Text variant="heading" accessibilityRole="header">
          Upcoming events
        </Text>
        <Pressable accessibilityRole="link" accessibilityLabel="See all events" onPress={() => router.push(category ? `/events?category=${category}` : '/events')}>
          <Text variant="caption" tone="accent">
            See all
          </Text>
        </Pressable>
      </View>

      {events.isPending ? (
        <LoadingState label="Loading events…" />
      ) : events.isError ? (
        <ErrorState error={events.error} onRetry={() => events.refetch()} />
      ) : events.data.items.length === 0 ? (
        <EmptyState
          icon="calendar-outline"
          title="No upcoming events"
          message="Nothing matches yet. Be the first to create one."
          actionLabel="Create an event"
          onAction={() => router.push('/events/new')}
        />
      ) : (
        <FlatList
          horizontal
          data={events.data.items}
          keyExtractor={(e) => e.id}
          renderItem={({ item }) => <EventCard event={item} />}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.cards}
          testID="upcoming-events"
        />
      )}

      <View style={[styles.cta, { paddingHorizontal: PAGE_MARGIN }]}>
        <Button title="Create an event" icon="add" iconLeft onPress={() => router.push('/events/new')} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: PAGE_MARGIN, paddingTop: 10, paddingBottom: 14 },
  live: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 28,
    paddingHorizontal: 11,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,195,0,0.5)',
    backgroundColor: 'rgba(255,195,0,0.12)',
  },
  liveOff: { borderColor: colors.border, backgroundColor: colors.surface },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.accent },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  block: { marginBottom: 14, paddingHorizontal: PAGE_MARGIN },
  chipsScroll: { marginBottom: 14, flexGrow: 0, flexShrink: 0, height: 32 },
  chips: { gap: 8, paddingHorizontal: PAGE_MARGIN },
  sectionHeader: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 },
  cards: { gap: 12, paddingHorizontal: PAGE_MARGIN },
  cta: { marginTop: 28 },
});
