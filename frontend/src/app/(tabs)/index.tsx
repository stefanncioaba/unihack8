// Home tab: header (Pulse, Help board, people), search, category chips, city info strip, AI shortcuts,
// Timișoara news, upcoming events, create-event button.
import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { EVENT_CATEGORIES, type EventCategory } from '@/api/types';
import { ShortcutBar } from '@/features/ai/ShortcutBar';
import { CATEGORY_META } from '@/features/events/categories';
import { EventCard } from '@/features/events/EventCards';
import { NewsStrip } from '@/features/news/NewsStrip';
import { CityInfoStrip } from '@/features/transit/CityInfoStrip';
import { useEventsPage } from '@/hooks/queries';
import { useHelpBoard } from '@/hooks/useHelp';
import { Button } from '@/ui/Button';
import { Chip } from '@/ui/Chip';
import { Icon } from '@/ui/Icon';
import { Screen } from '@/ui/Screen';
import { EmptyState, ErrorState, LoadingState } from '@/ui/States';
import { Text } from '@/ui/Text';
import { SearchField } from '@/ui/TextField';
import { colors, PAGE_MARGIN } from '@/ui/theme';

const HOME_EVENT_COUNT = 8;

/** Space taken by the section title above the cards, and by an event card's footer under its picture. */
const SECTION_HEADER_H = 42;
const CARD_FOOTER_H = 48;
const CARD_MIN_WIDTH = 150;
const CARD_MAX_WIDTH = 300;
/** Smallest the events section can get: its title plus the smallest card (16:9 picture and footer). */
const EVENTS_MIN_H = SECTION_HEADER_H + Math.ceil((CARD_MIN_WIDTH * 9) / 16) + CARD_FOOTER_H;

/** Card width that fits the height the events section has (the picture is 16:9), within sensible limits. */
export function eventCardWidth(sectionHeight: number | null): number {
  if (sectionHeight === null) return 264;
  const pictureHeight = sectionHeight - SECTION_HEADER_H - CARD_FOOTER_H;
  return Math.round(Math.min(CARD_MAX_WIDTH, Math.max(CARD_MIN_WIDTH, (pictureHeight * 16) / 9)));
}

/** The discovery-style Home page. */
export default function HomeScreen() {
  const [category, setCategory] = useState<EventCategory | null>(null);
  const events = useEventsPage({ category: category ? [category] : undefined, size: HOME_EVENT_COUNT });
  // Height the events section got on this screen; the cards are sized from it so everything fits without scrolling.
  const [sectionH, setSectionH] = useState<number | null>(null);
  const cardWidth = eventCardWidth(sectionH);

  return (
    <Screen scroll fit padded={false}>
      <View style={styles.header}>
        <Text variant="title" accessibilityRole="header">
          Timișoara
        </Text>
        <View style={styles.headerRight}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Neighbourhood pulse"
            onPress={() => router.push('/pulse')}
            style={[styles.iconButton, styles.pulseButton]}
          >
            <Icon name="pulse-outline" size={16} color={colors.accent} />
            <Text variant="chip" tone="accent">
              Pulse
            </Text>
          </Pressable>
          <HelpButton />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Find people"
            onPress={() => router.push('/users/search')}
            style={styles.iconButton}
          >
            <Icon name="people-outline" size={18} />
          </Pressable>
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

      {/* Timișoara news from local news sites (PLAN 26); "See all" opens the News screen. */}
      <NewsStrip />

      <View style={styles.events} onLayout={(e) => setSectionH(e.nativeEvent.layout.height)}>
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
            renderItem={({ item }) => <EventCard event={item} width={cardWidth} />}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.cards}
            testID="upcoming-events"
            style={styles.cardsList}
          />
        )}
      </View>

      <View style={[styles.cta, { paddingHorizontal: PAGE_MARGIN }]}>
        <Button title="Create an event" icon="add" iconLeft onPress={() => router.push('/events/new')} />
      </View>
    </Screen>
  );
}

/** Header button to the Neighbour Help Board, with the number of open requests when there are any. */
function HelpButton() {
  const board = useHelpBoard();
  const count = board.data?.length ?? 0;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Neighbour help board"
      accessibilityHint={count > 0 ? `${count} open requests` : undefined}
      onPress={() => router.push('/help')}
      style={[styles.iconButton, styles.pulseButton]}
    >
      <Icon name="hand-left-outline" size={16} color={colors.accent} />
      <Text variant="chip" tone="accent">
        Help
      </Text>
      {count > 0 ? (
        <View style={styles.countBadge} testID="help-count">
          <Text variant="chip" style={{ color: colors.signal, fontSize: 10 }}>
            {count}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: PAGE_MARGIN, paddingTop: 10, paddingBottom: 14 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
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
  pulseButton: { width: 'auto', flexDirection: 'row', gap: 5, paddingHorizontal: 12 },
  countBadge: { minWidth: 16, height: 16, borderRadius: 8, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(142,197,255,0.14)' },
  block: { marginBottom: 14, paddingHorizontal: PAGE_MARGIN },
  chipsScroll: { marginBottom: 10, flexGrow: 0, flexShrink: 0, height: 38 },
  chips: { gap: 8, paddingHorizontal: PAGE_MARGIN, alignItems: 'center' },
  sectionHeader: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 },
  events: { flex: 1, minHeight: EVENTS_MIN_H },
  cardsList: { flexGrow: 0 },
  cards: { gap: 12, paddingHorizontal: PAGE_MARGIN },
  cta: { marginTop: 8 },
});
