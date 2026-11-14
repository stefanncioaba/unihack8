// User search: find people by username and open their public profile (PLAN 13.8).
import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';

import { useUserSearch } from '@/hooks/queries';
import { useDebounced } from '@/hooks/useDebounced';
import { Avatar } from '@/ui/Avatar';
import { Icon } from '@/ui/Icon';
import { ReliabilityBadge } from '@/ui/ReliabilityBadge';
import { Screen } from '@/ui/Screen';
import { ScreenHeader } from '@/ui/ScreenHeader';
import { EmptyState, ErrorState, LoadingState } from '@/ui/States';
import { Text } from '@/ui/Text';
import { SearchField } from '@/ui/TextField';
import { colors, radius } from '@/ui/theme';

/** Search box + results; tapping a result opens `/users/<id>`. */
export default function UserSearchScreen() {
  const [text, setText] = useState('');
  const term = useDebounced(text.trim(), 300);
  const results = useUserSearch(term);

  return (
    <Screen edges={['top', 'bottom']}>
      <ScreenHeader title="Find people" />
      <SearchField placeholder="Search by username" value={text} onChangeText={setText} onClear={() => setText('')} autoFocus />
      <View style={{ flex: 1, marginTop: 12 }}>
        {term.length === 0 ? (
          <EmptyState icon="people-outline" title="Look someone up" message="Type a username to see their civic trust score and events they attended." />
        ) : results.isPending ? (
          <LoadingState label="Searching…" />
        ) : results.isError ? (
          <ErrorState error={results.error} onRetry={() => results.refetch()} />
        ) : (
          <FlatList
            testID="user-results"
            data={results.data}
            keyExtractor={(u) => u.id}
            keyboardShouldPersistTaps="handled"
            ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
            ListEmptyComponent={<EmptyState icon="search-outline" title="No one found" message={`Nobody's username starts with “${term}”.`} />}
            renderItem={({ item }) => (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Open profile of ${item.username}`}
                onPress={() => router.push(`/users/${item.id}`)}
                style={styles.row}
              >
                <Avatar size={40} />
                <Text variant="cardTitle" style={{ flex: 1 }} numberOfLines={1}>
                  {item.username}
                </Text>
                <ReliabilityBadge score={item.reliabilityScore} />
                <Icon name="chevron-forward" size={16} color={colors.textMuted} />
              </Pressable>
            )}
          />
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
});
