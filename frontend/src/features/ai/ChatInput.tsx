// The dark rounded input bar at the bottom of the chat, with a send button.
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Icon } from '@/ui/Icon';
import { MAX_CHAT_MESSAGE_CHARS } from '@/api/types.ai';
import { colors } from '@/ui/theme';

type Props = { onSend: (text: string) => void; disabled?: boolean };

/** Text box + send. Enter or the button sends; it is blocked while the assistant is thinking. */
export function ChatInput({ onSend, disabled }: Props) {
  const [text, setText] = useState('');
  const canSend = !disabled && text.trim().length > 0;

  /** Sends the text and clears the box. */
  function submit() {
    if (!canSend) return;
    onSend(text);
    setText('');
  }

  return (
    <View style={styles.bar}>
      <TextInput
        accessibilityLabel="Message"
        value={text}
        onChangeText={setText}
        onSubmitEditing={submit}
        placeholder="Ask about places, events, directions…"
        placeholderTextColor="#5D7393"
        selectionColor={colors.accent}
        returnKeyType="send"
        blurOnSubmit={false}
        multiline
        maxLength={MAX_CHAT_MESSAGE_CHARS}
        style={styles.input}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Send message"
        accessibilityState={{ disabled: !canSend }}
        onPress={submit}
        disabled={!canSend}
        style={[styles.send, canSend && styles.sendActive]}
      >
        <Icon name="arrow-up" size={18} color={canSend ? colors.onAccent : colors.textMuted} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingLeft: 14,
    paddingRight: 6,
    paddingVertical: 6,
    borderRadius: 26,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: -2 },
    elevation: 6,
  },
  input: { flex: 1, maxHeight: 110, minHeight: 36, color: colors.text, fontSize: 14, paddingVertical: 8 },
  send: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceAlt },
  sendActive: { backgroundColor: colors.accent },
});
