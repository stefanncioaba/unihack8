// Suggested questions shown above the input on an empty chat (PLAN 15.3).
import { ScrollView, StyleSheet } from 'react-native';

import { Chip } from '@/ui/Chip';

export const SUGGESTED_QUESTIONS = [
  'Where can I eat pizza near me?',
  'What can I do this weekend?',
  'Best coffee nearby?',
];

/** Compact chips; tapping one sends that question. */
export function Suggestions({ onPick }: { onPick: (question: string) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row} style={styles.scroll} keyboardShouldPersistTaps="handled" testID="suggestions">
      {SUGGESTED_QUESTIONS.map((q) => (
        <Chip key={q} label={q} onPress={() => onPick(q)} />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 0, flexShrink: 0, height: 34, marginHorizontal: -16, marginBottom: 10 },
  row: { gap: 8, paddingHorizontal: 16, alignItems: 'center' },
});
