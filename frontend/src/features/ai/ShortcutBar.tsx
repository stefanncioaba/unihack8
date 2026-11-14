// "Ask the city" section on Home (PLAN 13.10): saved AI questions as buttons. Tap asks it on the AI tab, "Edit" (or a
// long press) shows remove buttons, "Add" opens a small field for a new question.
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { MAX_CHAT_MESSAGE_CHARS } from '@/api/types.ai';
import { Button } from '@/ui/Button';
import { Icon } from '@/ui/Icon';
import { Text } from '@/ui/Text';
import { colors, PAGE_MARGIN, radius } from '@/ui/theme';

import { askOnAiTab, useShortcuts } from './shortcuts';

/** One saved question: a text-only navy pill, or a remove button in edit mode. */
function ShortcutButton({ text, editing, onLongPress, onRemove }: { text: string; editing: boolean; onLongPress: () => void; onRemove: () => void }) {
  if (editing) {
    return (
      <Pressable accessibilityRole="button" accessibilityLabel={`Remove shortcut ${text}`} onPress={onRemove} style={[styles.pill, styles.pillEditing]}>
        <Text variant="chip" numberOfLines={1} style={styles.label}>
          {text}
        </Text>
        <Icon name="close-circle" size={14} color={colors.danger} />
      </Pressable>
    );
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Ask ${text}`}
      accessibilityHint="Opens the AI tab and asks this question. Long press to edit shortcuts."
      onPress={() => askOnAiTab(text)}
      onLongPress={onLongPress}
      style={styles.pill}
    >
      <Text variant="chip" numberOfLines={1} style={styles.label}>
        {text}
      </Text>
    </Pressable>
  );
}

/** The section: header with Edit/Done, the row of shortcuts and the add field. */
export function ShortcutBar() {
  const { shortcuts, loading, add, remove, has, full } = useShortcuts();
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');
  const duplicate = draft.trim().length > 0 && has(draft);
  const canSave = draft.trim().length > 0 && !duplicate && !full;

  /** Saves the typed question and closes the field. */
  function save() {
    if (!canSave) return;
    add(draft);
    setDraft('');
    setAdding(false);
  }

  /** Removes one; leaves edit mode when the list becomes empty. */
  function removeOne(text: string) {
    remove(text);
    if (shortcuts.length <= 1) setEditing(false);
  }

  if (loading) return null;

  return (
    <View style={styles.section} testID="ai-shortcuts">
      <View style={styles.header}>
        <Text variant="heading" accessibilityRole="header">
          Ask the city
        </Text>
        {shortcuts.length > 0 && (
          <Pressable accessibilityRole="button" accessibilityLabel={editing ? 'Done editing shortcuts' : 'Edit shortcuts'} onPress={() => setEditing(!editing)} hitSlop={8}>
            <Text variant="caption" tone="accent">
              {editing ? 'Done' : 'Edit'}
            </Text>
          </Pressable>
        )}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row} style={styles.scroll} keyboardShouldPersistTaps="handled">
        {shortcuts.map((s) => (
          <ShortcutButton key={s} text={s} editing={editing} onLongPress={() => setEditing(true)} onRemove={() => removeOne(s)} />
        ))}
        {!editing && !adding && !full && (
          <Pressable accessibilityRole="button" accessibilityLabel="Add shortcut" onPress={() => setAdding(true)} style={[styles.pill, styles.addPill]}>
            <Icon name="add" size={14} color={colors.gold} />
            <Text variant="chip" tone="accent">
              {shortcuts.length === 0 ? 'Save a question' : 'Add'}
            </Text>
          </Pressable>
        )}
      </ScrollView>

      {shortcuts.length === 0 && !adding && (
        <Text variant="caption" tone="muted" style={styles.hint}>
          Save questions you ask often, like “Find cheapest coffee”, and ask them with one tap.
        </Text>
      )}

      {adding && (
        <View style={styles.addRow}>
          <TextInput
            accessibilityLabel="New shortcut"
            value={draft}
            onChangeText={setDraft}
            onSubmitEditing={save}
            placeholder="e.g. Find cheapest coffee"
            placeholderTextColor="#5D7393"
            selectionColor={colors.accent}
            returnKeyType="done"
            maxLength={MAX_CHAT_MESSAGE_CHARS}
            autoFocus
            style={styles.input}
          />
          <Button title="Save" small onPress={save} disabled={!canSave} />
          <Pressable accessibilityRole="button" accessibilityLabel="Cancel new shortcut" onPress={() => { setAdding(false); setDraft(''); }} hitSlop={8}>
            <Icon name="close" size={18} color={colors.textMuted} />
          </Pressable>
        </View>
      )}
      {adding && duplicate && (
        <Text variant="caption" tone="muted" style={styles.hint}>
          Already saved.
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: 18 },
  header: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10, paddingHorizontal: PAGE_MARGIN },
  scroll: { flexGrow: 0, flexShrink: 0 },
  row: { gap: 8, paddingHorizontal: PAGE_MARGIN, alignItems: 'center' },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 34,
    maxWidth: 240,
    paddingHorizontal: 13,
    borderRadius: radius.chip,
    backgroundColor: colors.oxford,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,214,10,0.35)',
  },
  pillEditing: { backgroundColor: colors.surface, borderColor: colors.border },
  addPill: { backgroundColor: 'transparent', borderStyle: 'dashed', borderWidth: 1, borderColor: 'rgba(255,214,10,0.45)' },
  label: { color: colors.text, flexShrink: 1 },
  hint: { marginTop: 8, paddingHorizontal: PAGE_MARGIN },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10, marginHorizontal: PAGE_MARGIN },
  input: {
    flex: 1,
    height: 38,
    paddingHorizontal: 12,
    borderRadius: radius.field,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
    color: colors.text,
    fontSize: 14,
  },
});
