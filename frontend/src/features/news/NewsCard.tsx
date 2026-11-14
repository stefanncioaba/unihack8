// One Timișoara news article (PLAN 26): picture, site and age, headline, and (full card) the short summary.
// Tapping opens the full story on the news site; we only show what the site's own feed gives.
import { useState } from 'react';
import { Image, Linking, Pressable, StyleSheet, View } from 'react-native';

import type { NewsItem } from '@/api/types.news';
import { Icon } from '@/ui/Icon';
import { Text } from '@/ui/Text';
import { colors, radius } from '@/ui/theme';

import { newsMeta } from './newsFormat';

/** Opens the article on the news site (in the phone's browser). */
export function openArticle(item: NewsItem) {
  Linking.openURL(item.url).catch(() => {});
}

/** The site's picture, or a newspaper icon when there is none or it fails to load. */
function Thumb({ uri, style, testID }: { uri: string | null; style: object; testID?: string }) {
  const [failed, setFailed] = useState(false);
  if (!uri || failed) {
    return (
      <View style={[style, styles.placeholder]} testID={testID ? `${testID}-placeholder` : undefined}>
        <Icon name="newspaper-outline" size={22} color={colors.textMuted} />
      </View>
    );
  }
  return <Image source={{ uri }} style={style} resizeMode="cover" onError={() => setFailed(true)} testID={testID} />;
}

/** Small card for the Home strip: thumbnail on the left, site · age and a 3-line headline. */
export function NewsCompactCard({ item, width }: { item: NewsItem; width: number }) {
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`${item.title}. ${newsMeta(item.sourceName, item.publishedAt)}`}
      onPress={() => openArticle(item)}
      style={({ pressed }) => [styles.compact, { width }, pressed && styles.pressed]}
      testID={`news-compact-${item.id}`}
    >
      <Thumb uri={item.imageUrl} style={styles.compactThumb} testID={`news-thumb-${item.id}`} />
      <View style={styles.compactText}>
        <Text variant="caption" tone="accent" numberOfLines={1}>
          {newsMeta(item.sourceName, item.publishedAt)}
        </Text>
        <Text variant="cardTitle" numberOfLines={3} style={styles.compactTitle}>
          {item.title}
        </Text>
      </View>
    </Pressable>
  );
}

/** Full card for the News screen: wide picture, site · age, headline, summary and "Read on <site>". */
export function NewsCard({ item }: { item: NewsItem }) {
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`${item.title}. ${newsMeta(item.sourceName, item.publishedAt)}`}
      onPress={() => openArticle(item)}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      testID={`news-card-${item.id}`}
    >
      <Thumb uri={item.imageUrl} style={styles.cardImage} testID={`news-image-${item.id}`} />
      <View style={styles.cardBody}>
        <Text variant="caption" tone="accent">
          {newsMeta(item.sourceName, item.publishedAt)}
        </Text>
        <Text variant="heading">{item.title}</Text>
        {item.summary ? (
          <Text variant="body" tone="muted" numberOfLines={4}>
            {item.summary}
          </Text>
        ) : null}
        <View style={styles.readMore}>
          <Text variant="caption" tone="signal">
            Read on {item.sourceName}
          </Text>
          <Icon name="open-outline" size={13} color={colors.signal} />
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.85 },
  placeholder: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceAlt },
  compact: {
    flexDirection: 'row',
    gap: 10,
    padding: 10,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  compactThumb: { width: 64, height: 64, borderRadius: 12, backgroundColor: colors.surfaceAlt },
  compactText: { flex: 1, gap: 2 },
  compactTitle: { lineHeight: 17, fontSize: 13 },
  card: {
    borderRadius: radius.card,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  cardImage: { width: '100%', aspectRatio: 16 / 9, backgroundColor: colors.surfaceAlt },
  cardBody: { padding: 14, gap: 6 },
  readMore: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
});
