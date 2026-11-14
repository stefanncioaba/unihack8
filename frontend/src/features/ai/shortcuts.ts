// Saved AI questions ("shortcuts", PLAN 13.10). Stored on the device only (AsyncStorage), shared between the Home
// buttons and the AI chat through one TanStack Query entry so both screens update together.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';

import { MAX_CHAT_MESSAGE_CHARS } from '@/api/types.ai';

export const SHORTCUTS_STORAGE_KEY = 'ai-shortcuts:v1';
export const MAX_SHORTCUTS = 12;
const QUERY_KEY = ['ai-shortcuts'] as const;

/** Trims and collapses spaces so "  Find  coffee " and "Find coffee" count as the same shortcut. */
export function normalizeShortcut(text: string): string {
  return text.trim().replace(/\s+/g, ' ').slice(0, MAX_CHAT_MESSAGE_CHARS);
}

/** True when `list` already holds this question (case-insensitive). */
export function hasShortcut(list: readonly string[], text: string): boolean {
  const key = normalizeShortcut(text).toLowerCase();
  return list.some((s) => s.toLowerCase() === key);
}

/** Reads the saved list; a missing or broken value is an empty list. */
export async function loadShortcuts(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(SHORTCUTS_STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((s): s is string => typeof s === 'string' && s.trim().length > 0) : [];
  } catch {
    return [];
  }
}

/** Writes the whole list. */
async function saveShortcuts(list: string[]): Promise<void> {
  await AsyncStorage.setItem(SHORTCUTS_STORAGE_KEY, JSON.stringify(list));
}

/** Opens the AI tab and asks `question` straight away (`at` makes the same shortcut twice still re-ask). */
export function askOnAiTab(question: string): void {
  router.push({ pathname: '/ai', params: { ask: question, at: String(Date.now()) } });
}

/** The saved shortcuts plus add / remove actions. New shortcuts go first; duplicates and blanks are ignored. */
export function useShortcuts() {
  const client = useQueryClient();
  const query = useQuery({ queryKey: QUERY_KEY, queryFn: loadShortcuts, staleTime: Infinity });
  const shortcuts = query.data ?? [];

  /** Applies `change` to the latest stored list, saves it and updates every screen. */
  const update = useMutation({
    mutationFn: async (change: (list: string[]) => string[]) => {
      const next = change(await loadShortcuts());
      await saveShortcuts(next);
      return next;
    },
    onSuccess: (next) => client.setQueryData(QUERY_KEY, next),
  });

  /** Saves a question as a shortcut. Returns false when it is blank, already saved or the list is full. */
  function add(text: string): boolean {
    const value = normalizeShortcut(text);
    if (!value || hasShortcut(shortcuts, value) || shortcuts.length >= MAX_SHORTCUTS) return false;
    update.mutate((list) => (hasShortcut(list, value) ? list : [value, ...list].slice(0, MAX_SHORTCUTS)));
    return true;
  }

  /** Removes a shortcut. */
  function remove(text: string): void {
    update.mutate((list) => list.filter((s) => s.toLowerCase() !== text.toLowerCase()));
  }

  return { shortcuts, loading: query.isPending, add, remove, has: (text: string) => hasShortcut(shortcuts, text), full: shortcuts.length >= MAX_SHORTCUTS };
}
