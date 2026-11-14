// AI chat (15.1–15.3): conversation, thinking indicator, errors + retry, new chat, suggestions, 20-message window.
import { act, fireEvent, renderHook, screen, within } from '@testing-library/react-native';
import { Linking } from 'react-native';

import * as endpoints from '@/api/endpoints.ai';
import { ApiError } from '@/api/errors';
import AiScreen from '@/app/(tabs)/ai';
import { useAiChat } from '@/hooks/useAi';
import { mockRequest, setMockLatency } from '@test/mocks';
import { placeId } from '@test/mocks/placesSeed';

import { IDS, mockRouter, renderScreen } from './testUtils';

/** Types a message and presses send. */
function say(text: string) {
  fireEvent.changeText(screen.getByLabelText('Message'), text);
  fireEvent.press(screen.getByRole('button', { name: 'Send message' }));
}

afterEach(() => jest.restoreAllMocks());

describe('AiScreen', () => {
  it('starts empty with the title, the motif and suggested questions', () => {
    renderScreen(<AiScreen />);
    expect(screen.getByText('Ask about the city')).toBeTruthy();
    expect(screen.getByTestId('chat-motif')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Where can I eat pizza near me?' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'What can I do this weekend?' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'New chat' })).toBeNull();
  });

  it('sends a typed message, shows the answer and clears the input', async () => {
    renderScreen(<AiScreen />);
    say('Where can I eat a cheap pizza?');
    expect(await screen.findByText('Where can I eat a cheap pizza?')).toBeTruthy();
    expect(await screen.findByText(/affordable meal/)).toBeTruthy();
    expect(screen.getByLabelText('Message').props.value).toBe('');
    expect(screen.queryByTestId('suggestions')).toBeNull();
    expect(screen.getByRole('button', { name: 'New chat' })).toBeTruthy();
  });

  it('cannot send an empty message', () => {
    renderScreen(<AiScreen />);
    const send = screen.getByRole('button', { name: 'Send message' });
    expect(send.props.accessibilityState).toMatchObject({ disabled: true });
    fireEvent.changeText(screen.getByLabelText('Message'), '   ');
    expect(screen.getByRole('button', { name: 'Send message' }).props.accessibilityState).toMatchObject({ disabled: true });
  });

  it('sends a suggested question when it is tapped', async () => {
    renderScreen(<AiScreen />);
    fireEvent.press(screen.getByRole('button', { name: 'What can I do this weekend?' }));
    expect(await screen.findByText(/Coming up in Timișoara/)).toBeTruthy();
  });

  it('shows a thinking indicator while waiting', async () => {
    setMockLatency(150);
    renderScreen(<AiScreen />);
    say('hello');
    expect(await screen.findByTestId('chat-thinking')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Send message' }).props.accessibilityState).toMatchObject({ disabled: true });
    expect(await screen.findByText(/I can help you find places/)).toBeTruthy();
    expect(screen.queryByTestId('chat-thinking')).toBeNull();
  });

  it('shows the sources the assistant used and opens them', async () => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    renderScreen(<AiScreen />);
    say('pizza please');
    fireEvent.press(await screen.findByRole('link', { name: /Open source Pizzeria Napoli/ }));
    expect(open).toHaveBeenCalledWith('https://example.ro/meniu');
  });

  it('shows an error and retries with the same conversation', async () => {
    const send = jest.spyOn(endpoints, 'sendChat');
    send.mockRejectedValueOnce(new ApiError(503, 'AI_UNAVAILABLE', 'The assistant did not answer.'));
    renderScreen(<AiScreen />);
    say('hello there');
    expect(await screen.findByText('The assistant did not answer.')).toBeTruthy();
    expect(screen.getByTestId('chat-error')).toBeTruthy();

    fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText(/I can help you find places/)).toBeTruthy();
    expect(screen.queryByTestId('chat-error')).toBeNull();
    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls[1][0].messages).toEqual([{ role: 'user', content: 'hello there' }]);
  });

  it('explains the rate limit', async () => {
    renderScreen(<AiScreen />);
    say('ratelimit');
    expect(await screen.findByText('Too many requests. Try again in a minute.')).toBeTruthy();
  });

  it('"New chat" clears the conversation and brings the suggestions back', async () => {
    renderScreen(<AiScreen />);
    say('hello');
    await screen.findByText(/I can help you find places/);
    fireEvent.press(screen.getByRole('button', { name: 'New chat' }));
    expect(screen.queryByText(/I can help you find places/)).toBeNull();
    expect(screen.getByTestId('suggestions')).toBeTruthy();
    expect(screen.getByTestId('chat-motif')).toBeTruthy();
  });

  it('ignores an answer that arrives after "New chat"', async () => {
    setMockLatency(150);
    renderScreen(<AiScreen />);
    say('hello');
    await screen.findByTestId('chat-thinking');
    fireEvent.press(screen.getByRole('button', { name: 'New chat' }));
    await act(async () => {
      await new Promise((r) => setTimeout(r, 400));
    });
    expect(screen.queryByText(/I can help you find places/)).toBeNull();
    expect(screen.queryByTestId('chat-thinking')).toBeNull();
    expect(screen.getByTestId('suggestions')).toBeTruthy();
  });
});

describe('result cards (15.4)', () => {
  it('shows a card for every place in the answer and opens it on the map', async () => {
    renderScreen(<AiScreen />);
    say('where can I eat pizza');
    const cards = await screen.findAllByTestId(/^result-place-/);
    expect(cards).toHaveLength(3);
    fireEvent.press(within(cards[0]).getByRole('button', { name: 'Show on map' }));
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: '/map',
      params: { lat: '45.7537', lon: '21.2257', title: 'Pizzeria Napoli', placeId: placeId(0), at: expect.any(String) },
    });
  });

  it('shows event cards that open the event or show it on the map', async () => {
    renderScreen(<AiScreen />);
    say('what can I do this weekend');
    const cards = await screen.findAllByTestId(/^result-event-/);
    expect(cards).toHaveLength(3);
    const first = within(cards[0]);
    fireEvent.press(first.getByRole('button', { name: 'Show on map' }));
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: '/map',
      params: expect.objectContaining({ eventId: expect.stringMatching(/^e0000000/), title: expect.any(String) }),
    });
  });

  it('shows no cards when the answer mentions nothing', async () => {
    renderScreen(<AiScreen />);
    say('hello');
    await screen.findByText(/I can help you find places/);
    expect(screen.queryByTestId('result-cards')).toBeNull();
  });
});

describe('useAiChat', () => {
  it('sends only the newest 20 messages and the location', async () => {
    const send = jest.spyOn(endpoints, 'sendChat').mockResolvedValue({ reply: 'ok', places: [], events: [], sources: [], routes: [] });
    const { result } = renderHook(() => useAiChat({ lat: 45.7, lon: 21.2 }));
    for (let i = 1; i <= 12; i++) await act(() => result.current.send(`question ${i}`));
    expect(result.current.messages).toHaveLength(24);
    const last = send.mock.calls[11][0];
    expect(last.messages).toHaveLength(20);
    expect(last.messages[19]).toEqual({ role: 'user', content: 'question 12' });
    expect(last.location).toEqual({ lat: 45.7, lon: 21.2 });
  });

  it('ignores blank text and sends nothing while thinking', async () => {
    const send = jest.spyOn(endpoints, 'sendChat').mockResolvedValue({ reply: 'ok', places: [], events: [], sources: [], routes: [] });
    const { result } = renderHook(() => useAiChat(null));
    await act(() => result.current.send('   '));
    expect(send).not.toHaveBeenCalled();
    expect(result.current.messages).toEqual([]);
  });
});

describe('mock /ai/chat', () => {
  it('requires between 1 and 20 messages', async () => {
    await expect(mockRequest('POST', '/ai/chat', {}, { messages: [], location: null })).rejects.toMatchObject({ status: 400, code: 'VALIDATION_FAILED' });
    const tooMany = Array.from({ length: 21 }, () => ({ role: 'user', content: 'x' }));
    await expect(mockRequest('POST', '/ai/chat', {}, { messages: tooMany, location: null })).rejects.toMatchObject({ status: 400 });
  });

  it('answers with places sorted by distance when the location is known', async () => {
    const res = (await mockRequest('POST', '/ai/chat', {}, { messages: [{ role: 'user', content: 'pizza' }], location: { lat: 45.7537, lon: 21.2257 } })) as any;
    expect(res.places[0].name).toBe('Pizzeria Napoli');
    const d = res.places.map((p: any) => p.distanceMeters);
    expect([...d].sort((a: number, b: number) => a - b)).toEqual(d);
    expect(res.sources).toHaveLength(1);
  });

  it('answers with events for weekend questions', async () => {
    const res = (await mockRequest('POST', '/ai/chat', {}, { messages: [{ role: 'user', content: 'what to do this weekend' }], location: null })) as any;
    expect(res.events).toHaveLength(3);
    expect(res.places).toEqual([]);
  });
});

