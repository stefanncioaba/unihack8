// AI tab: chat with the city guide (PLAN 15.1–15.3), with the cost box, result and route cards under answers (15.4, 18.4). The conversation lives in memory only; "New chat" clears it.
// `/ai?ask=…&at=…` (a Home shortcut, PLAN 13.10) starts a new chat with that question; each question can be saved as a shortcut.
import { Suggestions } from '@/features/ai/Suggestions';
import { useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import { ChatBubble, ErrorBubble, ThinkingBubble } from '@/features/ai/ChatBubble';
import { ChatInput } from '@/features/ai/ChatInput';
import { ChatMotif } from '@/features/ai/ChatMotif';
import { CostCard } from '@/features/ai/CostCard';
import { SaveShortcut } from '@/features/ai/SaveShortcut';
import { ResultCards } from '@/features/ai/ResultCards';
import { RouteCards } from '@/features/ai/RouteCards';
import { useCurrentPosition } from '@/features/location/LocationProvider';
import { useAiChat, type UiMessage } from '@/hooks/useAi';
import { Button } from '@/ui/Button';
import { Screen } from '@/ui/Screen';
import { Text } from '@/ui/Text';
import { colors } from '@/ui/theme';

/** Chat screen. */
export default function AiScreen() {
  const { position, isFallback } = useCurrentPosition();
  // Without permission the backend gets no location (it then cannot sort by distance).
  const chat = useAiChat(isFallback ? null : position);
  const listRef = useRef<FlatList<UiMessage>>(null);
  const empty = chat.messages.length === 0;
  const params = useLocalSearchParams<{ ask?: string; at?: string }>();
  // The last shortcut request handled, so a re-render does not ask the same question again.
  const handled = useRef<string | null>(null);
  const { askFresh } = chat;

  // A shortcut from Home: start a new chat with its question. `at` makes the same shortcut twice a new request.
  useEffect(() => {
    const ask = typeof params.ask === 'string' ? params.ask : '';
    const key = `${ask}|${params.at ?? ''}`;
    if (!ask.trim() || handled.current === key) return;
    handled.current = key;
    askFresh(ask);
  }, [params.ask, params.at, askFresh]);

  return (
    <Screen glow="lamp">
      {empty ? (
        <View style={styles.hero}>
          <View style={styles.motif} testID="chat-motif">
            <ChatMotif />
          </View>
          <Text variant="title" style={styles.center} accessibilityRole="header">
            Ask about the city
          </Text>
          <Text tone="muted" style={[styles.center, { marginTop: 6 }]}>
            Places to eat, things to do, how to get there.
          </Text>
        </View>
      ) : (
        <>
          <View style={styles.header}>
            <Text variant="title" accessibilityRole="header">
              Ask about the city
            </Text>
            <Button title="New chat" variant="secondary" small icon="create-outline" iconLeft onPress={chat.reset} />
          </View>
          <FlatList
            ref={listRef}
            testID="chat-list"
            data={chat.messages}
            keyExtractor={(m) => m.id}
            renderItem={({ item }) => (
              <ChatBubble message={item} userAction={<SaveShortcut question={item.content} />}>
                <CostCard cost={item.cost} />
                <ResultCards message={item} />
                <RouteCards routes={item.routes} />
              </ChatBubble>
            )}
            ListFooterComponent={
              chat.thinking ? <ThinkingBubble /> : chat.error ? <ErrorBubble error={chat.error} onRetry={chat.retry} /> : null
            }
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingTop: 8, paddingBottom: 16 }}
          />
        </>
      )}

      {empty && <Suggestions onPick={chat.send} />}
      <View style={styles.input}>
        {/* Soft fade so messages dissolve into the background above the input instead of being cut off. */}
        {!empty && (
          <LinearGradient
            pointerEvents="none"
            colors={['rgba(0,8,20,0)', colors.bg]}
            style={styles.fade}
          />
        )}
        <ChatInput onSend={chat.send} disabled={chat.thinking} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingBottom: 24 },
  motif: { marginBottom: 18 },
  center: { textAlign: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 10, paddingBottom: 6 },
  input: { paddingTop: 6, paddingBottom: 12 },
  fade: { position: 'absolute', left: 0, right: 0, top: -22, height: 28 },
});
