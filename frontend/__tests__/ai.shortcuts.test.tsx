// AI shortcuts (13.10): saved questions on Home, saving from the chat, and the AI tab asking a shortcut on arrival.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react-native';

import AiScreen from '@/app/(tabs)/ai';
import HomeScreen from '@/app/(tabs)/index';
import { hasShortcut, loadShortcuts, MAX_SHORTCUTS, normalizeShortcut, SHORTCUTS_STORAGE_KEY } from '@/features/ai/shortcuts';
import { setMockLatency } from '@test/mocks';

import { AuthContext } from '@/features/auth/AuthProvider';

import { fakeAuth, mockRouter, renderScreen, setParams } from './testUtils';

/** The AI screen inside the same providers `renderScreen` used, for re-renders after new route params. */
function aiAgain(client: QueryClient) {
  return (
    <QueryClientProvider client={client}>
      <AuthContext.Provider value={fakeAuth()}>
        <AiScreen />
      </AuthContext.Provider>
    </QueryClientProvider>
  );
}

/** Puts a list straight into device storage, as if saved in an earlier session. */
async function seed(list: string[]) {
  await AsyncStorage.setItem(SHORTCUTS_STORAGE_KEY, JSON.stringify(list));
}

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('shortcut helpers', () => {
  it('normalizes spaces and finds duplicates case-insensitively', () => {
    expect(normalizeShortcut('  Find   cheapest coffee ')).toBe('Find cheapest coffee');
    expect(hasShortcut(['Find cheapest coffee'], 'find CHEAPEST  coffee')).toBe(true);
    expect(hasShortcut(['Find cheapest coffee'], 'Find pizza')).toBe(false);
  });

  it('reads a broken stored value as an empty list', async () => {
    await AsyncStorage.setItem(SHORTCUTS_STORAGE_KEY, '{not json');
    expect(await loadShortcuts()).toEqual([]);
    await AsyncStorage.setItem(SHORTCUTS_STORAGE_KEY, JSON.stringify(['ok', 3, '']));
    expect(await loadShortcuts()).toEqual(['ok']);
  });
});

describe('Home shortcuts', () => {
  it('shows a hint and an add button when nothing is saved', async () => {
    renderScreen(<HomeScreen />);
    const section = within(await screen.findByTestId('ai-shortcuts'));
    expect(section.getByText('Ask the city')).toBeTruthy();
    expect(section.getByText(/Save questions you ask often/)).toBeTruthy();
    expect(section.getByRole('button', { name: 'Add shortcut' })).toBeTruthy();
    expect(section.queryByRole('button', { name: 'Edit shortcuts' })).toBeNull();
  });

  it('adds a typed shortcut, stores it on the device and shows it as a button', async () => {
    renderScreen(<HomeScreen />);
    fireEvent.press(await screen.findByRole('button', { name: 'Add shortcut' }));
    fireEvent.changeText(screen.getByLabelText('New shortcut'), '  Find cheapest coffee ');
    fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('button', { name: 'Ask Find cheapest coffee' })).toBeTruthy();
    expect(screen.queryByLabelText('New shortcut')).toBeNull();
    expect(JSON.parse((await AsyncStorage.getItem(SHORTCUTS_STORAGE_KEY))!)).toEqual(['Find cheapest coffee']);
  });

  it('does not save a duplicate', async () => {
    await seed(['Find cheapest coffee']);
    renderScreen(<HomeScreen />);
    fireEvent.press(await screen.findByRole('button', { name: 'Add shortcut' }));
    fireEvent.changeText(screen.getByLabelText('New shortcut'), 'find cheapest coffee');
    expect(screen.getByText('Already saved.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Save' }).props.accessibilityState).toMatchObject({ disabled: true });
  });

  it('opens the AI tab with the question when a shortcut is tapped', async () => {
    await seed(['Find cheapest coffee']);
    renderScreen(<HomeScreen />);
    fireEvent.press(await screen.findByRole('button', { name: 'Ask Find cheapest coffee' }));
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/ai', params: { ask: 'Find cheapest coffee', at: expect.any(String) } });
  });

  it('removes a shortcut in edit mode (opened by Edit or a long press)', async () => {
    await seed(['Find cheapest coffee', 'Where can I go out this weekend?']);
    renderScreen(<HomeScreen />);
    fireEvent(await screen.findByRole('button', { name: 'Ask Find cheapest coffee' }), 'longPress');
    expect(screen.getByRole('button', { name: 'Done editing shortcuts' })).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Remove shortcut Find cheapest coffee' }));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Remove shortcut Find cheapest coffee' })).toBeNull());
    fireEvent.press(screen.getByRole('button', { name: 'Done editing shortcuts' }));
    expect(screen.getByRole('button', { name: 'Ask Where can I go out this weekend?' })).toBeTruthy();
    expect(await loadShortcuts()).toEqual(['Where can I go out this weekend?']);
  });

  it('hides the add button when the list is full', async () => {
    await seed(Array.from({ length: MAX_SHORTCUTS }, (_, i) => `Question ${i + 1}`));
    renderScreen(<HomeScreen />);
    expect(await screen.findByRole('button', { name: 'Ask Question 1' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Add shortcut' })).toBeNull();
  });
});

describe('AI tab and shortcuts', () => {
  it('asks the shortcut question as soon as it opens', async () => {
    setParams({ ask: 'Find cheapest coffee', at: '1' });
    renderScreen(<AiScreen />);
    expect(await screen.findByText('Find cheapest coffee')).toBeTruthy();
    expect(await screen.findAllByTestId('chat-message-assistant')).toHaveLength(1);
  });

  it('does not ask the same request twice on a re-render, but does for a new tap', async () => {
    setParams({ ask: 'Best coffee nearby?', at: '1' });
    const { rerender, client } = renderScreen(<AiScreen />);
    await screen.findAllByTestId('chat-message-assistant');
    rerender(aiAgain(client));
    expect(screen.getAllByTestId('chat-message-user')).toHaveLength(1);
    // A second tap on Home (new `at`) starts a fresh chat with the question again.
    setParams({ ask: 'Best coffee nearby?', at: '2' });
    rerender(aiAgain(client));
    await waitFor(() => expect(screen.getAllByTestId('chat-message-assistant')).toHaveLength(1));
    expect(screen.getAllByTestId('chat-message-user')).toHaveLength(1);
  });

  it('starts a fresh chat even while an earlier answer is on its way', async () => {
    setMockLatency(100);
    const { rerender, client } = renderScreen(<AiScreen />);
    fireEvent.changeText(screen.getByLabelText('Message'), 'hello');
    fireEvent.press(screen.getByRole('button', { name: 'Send message' }));
    expect(await screen.findByTestId('chat-thinking')).toBeTruthy();
    setParams({ ask: 'What can I do this weekend?', at: '9' });
    rerender(aiAgain(client));
    expect(await screen.findByText(/Coming up in Timișoara/)).toBeTruthy();
    expect(screen.queryByText('hello')).toBeNull();
  });

  it('saves a sent question as a shortcut and can undo it', async () => {
    renderScreen(<AiScreen />);
    fireEvent.changeText(screen.getByLabelText('Message'), 'Find cheapest coffee');
    fireEvent.press(screen.getByRole('button', { name: 'Send message' }));
    fireEvent.press(await screen.findByRole('button', { name: 'Save as shortcut Find cheapest coffee' }));
    expect(await screen.findByText('Saved to Home')).toBeTruthy();
    expect(await loadShortcuts()).toEqual(['Find cheapest coffee']);
    fireEvent.press(screen.getByRole('button', { name: 'Remove shortcut Find cheapest coffee' }));
    expect(await screen.findByText('Save as shortcut')).toBeTruthy();
    await act(async () => {});
    expect(await loadShortcuts()).toEqual([]);
  });
});
