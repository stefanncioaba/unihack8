// "Leave now" box under an AI route card (PLAN 26): countdown states, the vehicle to catch, and that it shows
// only for a tram/bus trip from the user.
import { act, render, screen, within, fireEvent } from '@testing-library/react-native';

import type { ChatLeaveNow } from '@/api/types.ai';
import AiScreen from '@/app/(tabs)/ai';
import { LeaveNowBox, leaveState, vehicleNoun } from '@/features/ai/LeaveNowBox';
import { LocationProvider } from '@/features/location/LocationProvider';

import { renderScreen } from './testUtils';

const MIN = 60_000;
const NOW = Date.parse('2026-11-14T18:00:00Z');

/** Tram 1 reaching Piața Libertății `boardIn` minutes from NOW, after a 4 min walk (leave 5 min before boarding). */
function leave(boardIn = 11, extra: Partial<ChatLeaveNow> = {}): ChatLeaveNow {
  return {
    line: '1',
    vehicleType: 'TRAM',
    headsign: 'Gara de Nord',
    stopName: 'Piața Libertății',
    walkMinutes: 4,
    boardAt: new Date(NOW + boardIn * MIN).toISOString(),
    leaveAt: new Date(NOW + (boardIn - 5) * MIN).toISOString(),
    source: 'LIVE',
    missedBoardAt: null,
    ...extra,
  };
}

describe('leaveState', () => {
  it('counts down the minutes until it is time to leave', () => {
    expect(leaveState(leave(11), NOW)).toEqual({ kind: 'soon', minutes: 6 });
    expect(leaveState(leave(11), NOW + 5 * MIN + 30_000)).toEqual({ kind: 'now' });
  });

  it('says hurry once the spare minute is used, and missed when the walk no longer makes it', () => {
    expect(leaveState(leave(11), NOW + 6 * MIN + 45_000)).toEqual({ kind: 'hurry' });
    expect(leaveState(leave(11), NOW + 7 * MIN + 1_000)).toEqual({ kind: 'missed' });
  });

  it('gives a clock time when leaving is more than an hour away', () => {
    expect(leaveState(leave(120), NOW)).toEqual({ kind: 'later' });
  });

  it('names the vehicle', () => {
    expect(vehicleNoun('TRAM')).toBe('tram');
    expect(vehicleNoun('trolleybus')).toBe('trolleybus');
    expect(vehicleNoun('BUS')).toBe('bus');
  });
});

describe('LeaveNowBox', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(NOW);
  });
  afterEach(() => jest.useRealTimers());

  it('shows the countdown, the tram to catch, the walk and the live source', () => {
    render(<LeaveNowBox leave={leave(11, { missedBoardAt: new Date(NOW + 3 * MIN).toISOString() })} index={0} />);
    expect(screen.getByTestId('leave-now-headline')).toHaveTextContent('Leave in 6 min');
    expect(screen.getByText(/to catch/)).toHaveTextContent('to catch tram 1 towards Gara de Nord at Piața Libertății at 20:11');
    expect(screen.getByText(/min walk to the stop/)).toHaveTextContent('4 min walk to the stop · the 20:03 one leaves too soon');
    expect(screen.getByText('Live')).toBeTruthy();
  });

  it('keeps counting down while it is on screen', () => {
    render(<LeaveNowBox leave={leave(11)} index={0} />);
    act(() => jest.advanceTimersByTime(6 * MIN));
    expect(screen.getByTestId('leave-now-headline')).toHaveTextContent('Leave now');
    act(() => jest.advanceTimersByTime(2 * MIN));
    expect(screen.getByTestId('leave-now-headline')).toHaveTextContent("You won't make this one");
    expect(screen.getByText(/It was the/)).toHaveTextContent(/Tap Go or ask again for the next one/);
  });

  it('labels timetable and planner times as not live', () => {
    const { rerender } = render(<LeaveNowBox leave={leave(11, { source: 'TIMETABLE' })} index={0} />);
    expect(screen.getByText('Scheduled')).toBeTruthy();
    rerender(<LeaveNowBox leave={leave(11, { source: 'PLAN' })} index={0} />);
    expect(screen.getByText('Planned')).toBeTruthy();
  });
});

describe('in the AI chat', () => {
  /** Types a message and presses send. */
  function say(text: string) {
    fireEvent.changeText(screen.getByLabelText('Message'), text);
    fireEvent.press(screen.getByRole('button', { name: 'Send message' }));
  }

  /** The chat with the mocked GPS, so answers start at the user. */
  function renderChat() {
    return renderScreen(
      <LocationProvider>
        <AiScreen />
      </LocationProvider>,
    );
  }

  it('shows the box under the route card of a tram trip from the user', async () => {
    renderChat();
    await screen.findByText('Ask about the city');
    say('How do I get to a coffee place by tram?');
    const box = within(await screen.findByTestId('leave-now-0'));
    expect(box.getByTestId('leave-now-headline')).toHaveTextContent(/^Leave in \d+ min$/);
    expect(box.getByText(/to catch/)).toHaveTextContent(/tram 1 towards Gara de Nord at Piața Libertății/);
    expect(screen.getByTestId('result-route-0')).toBeTruthy();
  });

  it('has no box for a walking route', async () => {
    renderChat();
    await screen.findByText('Ask about the city');
    say('How do I get to a coffee place?');
    await screen.findByTestId('result-route-0');
    expect(screen.queryByTestId('leave-now-0')).toBeNull();
  });
});
