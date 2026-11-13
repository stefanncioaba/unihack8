// Conversation state of the AI chat. Nothing is stored anywhere: the whole conversation lives in memory, is sent to the
// backend on every message, and "New chat" just clears it (PLAN 15.2).
import { useCallback, useRef, useState } from 'react';

import { sendChat } from '@/api/endpoints.ai';
import type { EventSummary } from '@/api/types';
import { MAX_CHAT_MESSAGE_CHARS, MAX_CHAT_MESSAGES, type ChatRole, type ChatSource } from '@/api/types.ai';
import type { PlaceSummary } from '@/api/types.places';

/** A message as the chat screen shows it (assistant messages can carry result cards and sources). */
export type UiMessage = {
  id: string;
  role: ChatRole;
  content: string;
  places?: PlaceSummary[];
  events?: EventSummary[];
  sources?: ChatSource[];
};

type Location = { lat: number; lon: number } | null;

let nextId = 0;
/** Unique id for a message (stable keys for the list). */
const newId = () => `m${++nextId}`;

/** Chat state: messages, a "thinking" flag, the last error and send / retry / reset actions. */
export function useAiChat(location: Location) {
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const messagesRef = useRef<UiMessage[]>([]);
  // Bumped by reset(); an answer that arrives for an older conversation is ignored.
  const generation = useRef(0);

  /** Updates the list in state and in the ref (the ref lets retry() read the latest list). */
  const commit = useCallback((next: UiMessage[]) => {
    messagesRef.current = next;
    setMessages(next);
  }, []);

  /** Sends the history (the newest 20 messages) and appends the assistant's answer. */
  const ask = useCallback(
    async (history: UiMessage[]) => {
      const mine = generation.current;
      setThinking(true);
      try {
        // The API accepts at most MAX_CHAT_MESSAGE_CHARS per message (docs/API.md); trim long history entries.
        const payload = history
          .slice(-MAX_CHAT_MESSAGES)
          .map(({ role, content }) => ({ role, content: content.slice(0, MAX_CHAT_MESSAGE_CHARS) }));
        const answer = await sendChat({ messages: payload, location });
        if (mine !== generation.current) return;
        commit([
          ...messagesRef.current,
          { id: newId(), role: 'assistant', content: answer.reply, places: answer.places, events: answer.events, sources: answer.sources },
        ]);
      } catch (e) {
        if (mine === generation.current) setError(e);
      } finally {
        if (mine === generation.current) setThinking(false);
      }
    },
    [commit, location],
  );

  /** Adds the user's message and asks the assistant. Ignored while it is already thinking. */
  const send = useCallback(
    async (text: string) => {
      const content = text.trim();
      if (!content || thinking) return;
      const history = [...messagesRef.current, { id: newId(), role: 'user' as const, content }];
      commit(history);
      setError(null);
      await ask(history);
    },
    [ask, commit, thinking],
  );

  /** Asks again after an error, with the same conversation. */
  const retry = useCallback(async () => {
    if (thinking || !error) return;
    setError(null);
    await ask(messagesRef.current);
  }, [ask, error, thinking]);

  /** "New chat": forgets everything, including an answer that is still on its way. */
  const reset = useCallback(() => {
    generation.current += 1;
    commit([]);
    setError(null);
    setThinking(false);
  }, [commit]);

  return { messages, thinking, error, send, retry, reset };
}
