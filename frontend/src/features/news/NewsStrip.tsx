// "Timișoara news" on Home (PLAN 27): the newest headlines from local news sites in one swipeable row,
// with "See all" opening the News screen. Small on purpose so Home still fits the screen.
import { router } from 'expo-router';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';

import { useLatestNews } from '@/hooks/useNews';
import { Text } from '@/ui/Text';
import { PAGE_MARGIN } from '@/ui/theme';

import { NewsCompactCard } from './NewsCard';

const CARD_WIDTH = 260;

/** The strip; a quiet one-line message instead of cards while loading or when the sites cannot be read. */
export function NewsStrip() {
  const news = useLatestNews();
  const items = news.data?.items ?? [];

  return (
    <View style={styles.section} testID="news-strip">
      <View style={styles.header}>
        <Text variant="heading" accessibilityRole="header">
          Timișoara news
        </Text>
        <Pressable accessibilityRole="link" accessibilityLabel="See all news" onPress={() => router.push('/news')}>
          <Text variant="caption" tone="accent">
            See all
          </Text>
        </Pressable>
      </View>
      {news.isPending ? (
        <Text variant="caption" tone="muted" style={styles.note}>
          Loading the latest news…
        </Text>
      ) : news.isError ? (
        <Text variant="caption" tone="muted" style={styles.note} testID="news-strip-error">
          News is unavailable right now.
        </Text>
      ) : items.length === 0 ? (
        <Text variant="caption" tone="muted" style={styles.note}>
          No Timișoara news right now.
        </Text>
      ) : (
        <FlatList
          horizontal
          data={items}
          keyExtractor={(n) => n.id}
          renderItem={({ item }) => <NewsCompactCard item={item} width={CARD_WIDTH} />}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.cards}
          testID="news-strip-list"
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: 14 },
  header: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingHorizontal: PAGE_MARGIN, marginBottom: 10 },
  note: { paddingHorizontal: PAGE_MARGIN },
  cards: { gap: 10, paddingHorizontal: PAGE_MARGIN },
});
