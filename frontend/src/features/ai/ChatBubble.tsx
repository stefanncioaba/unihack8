// Chat bubbles: Oxford Navy on the right for the user, Prussian Blue on the left for the assistant, plus the
// "thinking" and error bubbles (PLAN 15.1).
import type { ReactNode } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, View } from 'react-native';

import { friendlyError } from '@/api/errors';
import type { ChatSource } from '@/api/types.ai';
import type { UiMessage } from '@/hooks/useAi';
import { Button } from '@/ui/Button';
import { Icon } from '@/ui/Icon';
import { Text } from '@/ui/Text';
import { colors } from '@/ui/theme';

type BubbleProps = { message: UiMessage; children?: ReactNode };

/** Links to the web pages the assistant used. */
function Sources({ sources }: { sources: ChatSource[] }) {
  return (
    <View style={styles.sources} testID="chat-sources">
      <Text variant="caption" tone="muted">
        Sources
      </Text>
      {sources.map((s) => (
        <Pressable key={s.url} accessibilityRole="link" accessibilityLabel={`Open source ${s.title}`} onPress={() => Linking.openURL(s.url)} style={styles.source}>
          <Icon name="link-outline" size={12} color={colors.gold} />
          <Text variant="caption" tone="accent" numberOfLines={1} style={{ flexShrink: 1 }}>
            {s.title}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

/** One message. `children` (result cards) are drawn under an assistant bubble. */
export function ChatBubble({ message, children }: BubbleProps) {
  const mine = message.role === 'user';
  return (
    <View style={[styles.row, mine ? styles.rowMine : styles.rowTheirs]} testID={`chat-message-${message.role}`}>
      <View style={[styles.bubble, mine ? styles.mine : styles.theirs]}>
        <Text>{message.content}</Text>
        {!mine && message.sources && message.sources.length > 0 ? <Sources sources={message.sources} /> : null}
      </View>
      {!mine && children}
    </View>
  );
}

/** Shown while the assistant is working. */
export function ThinkingBubble() {
  return (
    <View style={[styles.row, styles.rowTheirs]} accessibilityLabel="The assistant is thinking" testID="chat-thinking">
      <View style={[styles.bubble, styles.theirs, styles.thinking]}>
        <ActivityIndicator size="small" color={colors.signal} />
        <Text tone="muted">Thinking…</Text>
      </View>
    </View>
  );
}

/** Shown when a request failed; "Try again" repeats it with the same conversation. */
export function ErrorBubble({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  return (
    <View style={[styles.row, styles.rowTheirs]} testID="chat-error">
      <View style={[styles.bubble, styles.theirs, styles.errorBubble]}>
        <Text tone="danger" accessibilityRole="alert">
          {friendlyError(error)}
        </Text>
        <Button title="Try again" variant="secondary" small onPress={onRetry} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { marginBottom: 14, maxWidth: '100%' },
  rowMine: { alignItems: 'flex-end' },
  rowTheirs: { alignItems: 'flex-start', gap: 8 },
  bubble: { maxWidth: '86%', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 16, gap: 8 },
  mine: { backgroundColor: colors.bubble, borderBottomRightRadius: 4 },
  theirs: {
    backgroundColor: colors.surface,
    borderBottomLeftRadius: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  thinking: { flexDirection: 'row', alignItems: 'center' },
  errorBubble: { alignItems: 'flex-start' },
  sources: { gap: 4, paddingTop: 6, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  source: { flexDirection: 'row', alignItems: 'center', gap: 5 },
});
