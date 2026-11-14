// Small "Save as shortcut" link under a question the user sent in the AI chat (PLAN 13.10). Saved questions appear as
// buttons on Home; once saved the link turns into a muted "Saved to Home" that removes it again when tapped.
import { Pressable, StyleSheet } from 'react-native';

import { Icon } from '@/ui/Icon';
import { Text } from '@/ui/Text';
import { colors } from '@/ui/theme';

import { useShortcuts } from './shortcuts';

/** The link for one question. Hidden when the list is full and this question is not in it. */
export function SaveShortcut({ question }: { question: string }) {
  const { add, remove, has, full, loading } = useShortcuts();
  const saved = has(question);
  if (loading || (full && !saved)) return null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={saved ? `Remove shortcut ${question}` : `Save as shortcut ${question}`}
      onPress={() => (saved ? remove(question) : add(question))}
      hitSlop={8}
      style={styles.link}
    >
      <Icon name={saved ? 'bookmark' : 'bookmark-outline'} size={12} color={saved ? colors.textMuted : colors.gold} />
      <Text variant="caption" tone={saved ? 'muted' : 'accent'}>
        {saved ? 'Saved to Home' : 'Save as shortcut'}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  link: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 5, paddingHorizontal: 2 },
});
