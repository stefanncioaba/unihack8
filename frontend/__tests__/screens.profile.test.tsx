// My profile (PLAN 16.1–16.3): score explanation and history, change username, my events.
import { fireEvent, screen, waitFor, within } from '@testing-library/react-native';

import ProfileScreen from '@/app/(tabs)/profile';
import { joinEvent } from '@/api/endpoints';
import * as endpoints from '@/api/endpoints.users';
import { ApiError } from '@/api/errors';
import type { EventSummary } from '@/api/types';
import { groupMyEvents } from '@/features/users/MyEvents';
import { formatPoints, reasonLabel } from '@/features/users/reliability';
import { getMockState } from '@test/mocks';

import { IDS, mockRouter, renderScreen } from './testUtils';

const ME = '11111111-1111-4111-8111-111111111111';

/** Opens the username editor and types a name. */
async function startEditing(name: string) {
  fireEvent.press(await screen.findByRole('button', { name: 'Change username' }));
  fireEvent.changeText(screen.getByLabelText('Username'), name);
}

describe('ProfileScreen: score explanation (16.1)', () => {
  it('lists the three rules in the "How it works" panel', async () => {
    renderScreen(<ProfileScreen />);
    fireEvent.press(await screen.findByRole('button', { name: 'How the score works' }));
    const panel = screen.getByTestId('score-explainer');
    expect(within(panel).getByText('+5')).toBeTruthy();
    expect(within(panel).getByText('−10')).toBeTruthy();
    expect(within(panel).getByText('−2')).toBeTruthy();
    expect(within(panel).getByText(/never drops below 0/)).toBeTruthy();
  });
});

describe('ProfileScreen: reliability history (16.1)', () => {
  it('shows each change with its reason, event and points', async () => {
    renderScreen(<ProfileScreen />);
    const log = await screen.findByTestId('reliability-log');
    expect(within(log).getByText('Missed the event')).toBeTruthy();
    expect(within(log).getByText('−10')).toBeTruthy();
    expect(within(log).getAllByText('Attended')).toHaveLength(2);
    expect(within(log).getAllByText('+5')).toHaveLength(2);
    expect(within(log).getByText(/Open mic night/)).toBeTruthy();
  });

  it('opens the event of an entry', async () => {
    renderScreen(<ProfileScreen />);
    fireEvent.press(await screen.findByText(/Open mic night/));
    expect(mockRouter.push).toHaveBeenCalledWith('/events/e0000000-0000-4000-8000-000000000103');
  });

  it('says so when there is no history yet', async () => {
    getMockState().reliabilityLog[ME] = [];
    renderScreen(<ProfileScreen />);
    expect(await screen.findByText('No changes yet')).toBeTruthy();
  });

  it('shows an error only in the history block when it cannot be loaded (backend task 6.4 pending)', async () => {
    jest.spyOn(endpoints, 'getReliability').mockRejectedValue(new ApiError(404, 'NOT_FOUND', 'missing'));
    renderScreen(<ProfileScreen />);
    expect(await screen.findByTestId('error-state')).toBeTruthy();
    expect(screen.getByText('demo_user')).toBeTruthy();
    expect(screen.getByTestId('my-events')).toBeTruthy();
    jest.restoreAllMocks();
  });
});

describe('ProfileScreen: change username (16.2)', () => {
  it('saves a new username and shows it', async () => {
    renderScreen(<ProfileScreen />);
    await startEditing('night_owl');
    fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('night_owl')).toBeTruthy();
    expect(screen.queryByTestId('username-editor')).toBeNull();
    expect(getMockState().users.find((u) => u.id === ME)?.username).toBe('night_owl');
  });

  it('shows "already taken" and keeps the form open', async () => {
    renderScreen(<ProfileScreen />);
    await startEditing('stefan');
    fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('That username is already taken.')).toBeTruthy();
    expect(screen.getByTestId('username-editor')).toBeTruthy();
  });

  it('clears the server error as soon as the user edits again', async () => {
    renderScreen(<ProfileScreen />);
    await startEditing('stefan');
    fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    await screen.findByText('That username is already taken.');
    fireEvent.changeText(screen.getByLabelText('Username'), 'stefan2');
    await waitFor(() => expect(screen.queryByText('That username is already taken.')).toBeNull());
  });

  it('validates the format locally without calling the server', async () => {
    const spy = jest.spyOn(endpoints, 'changeUsername');
    renderScreen(<ProfileScreen />);
    await startEditing('a!');
    expect(screen.getByText('Use 3–20 letters, digits or underscores.')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('closes without a request when the name did not change', async () => {
    const spy = jest.spyOn(endpoints, 'changeUsername');
    renderScreen(<ProfileScreen />);
    fireEvent.press(await screen.findByRole('button', { name: 'Change username' }));
    fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.queryByTestId('username-editor')).toBeNull());
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('cancels without saving', async () => {
    renderScreen(<ProfileScreen />);
    await startEditing('night_owl');
    fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByTestId('username-editor')).toBeNull();
    expect(screen.getByText('demo_user')).toBeTruthy();
  });
});

describe('ProfileScreen: my events (16.3)', () => {
  it('groups upcoming, organised and attended events', async () => {
    renderScreen(<ProfileScreen />);
    const upcoming = await screen.findByTestId('my-events-upcoming');
    expect(within(upcoming).getByText('Art walk through the old town')).toBeTruthy();
    const organising = screen.getByTestId('my-events-organizing');
    expect(within(organising).getByText('Sunset run by the Bega')).toBeTruthy();
    const attended = screen.getByTestId('my-events-attended');
    expect(within(attended).getByText('Autumn photo walk')).toBeTruthy();
    expect(within(attended).getByText('Retro gaming evening')).toBeTruthy();
  });

  it('does not list an event I missed as attended', async () => {
    renderScreen(<ProfileScreen />);
    const attended = await screen.findByTestId('my-events-attended');
    expect(within(attended).queryByText('Open mic night')).toBeNull();
  });

  it('opens an event when tapped', async () => {
    renderScreen(<ProfileScreen />);
    fireEvent.press(await screen.findByTestId(`event-row-${IDS.artWalk}`));
    expect(mockRouter.push).toHaveBeenCalledWith(`/events/${IDS.artWalk}`);
  });

  it('shows an event right after joining it', async () => {
    const { client } = renderScreen(<ProfileScreen />);
    await screen.findByTestId('my-events');
    await joinEvent(IDS.boardGames);
    await client.invalidateQueries({ queryKey: ['users', 'me', 'events'] });
    expect(await within(screen.getByTestId('my-events-upcoming')).findByText('Board games night')).toBeTruthy();
  });

  it('shows an empty state when I have no events', async () => {
    getMockState().events = [];
    renderScreen(<ProfileScreen />);
    expect(await screen.findByText('Events you join or organise show up here.')).toBeTruthy();
  });

  it('shows an error with retry when the events cannot be loaded', async () => {
    const spy = jest.spyOn(endpoints, 'getMyEvents').mockRejectedValue(new ApiError(0, 'NETWORK', 'down'));
    renderScreen(<ProfileScreen />);
    expect(await screen.findByTestId('error-state')).toBeTruthy();
    spy.mockRestore();
  });
});

describe('groupMyEvents', () => {
  const now = Date.parse('2026-11-14T12:00:00Z');
  const ev = (id: string, startsAt: string, endsAt: string | null = null): EventSummary => ({
    id,
    source: 'USER',
    title: id,
    category: 'OTHER',
    venueName: null,
    lat: null,
    lon: null,
    startsAt,
    endsAt,
    imageUrl: null,
    priceMin: null,
    priceMax: null,
    capacity: null,
    spotsLeft: null,
  });

  it('keeps only future joined events as upcoming, and drops ended ones', () => {
    const groups = groupMyEvents(
      [
        { event: ev('soon', '2026-11-14T18:00:00Z'), status: 'JOINED' },
        { event: ev('over', '2026-11-14T08:00:00Z'), status: 'JOINED' },
        { event: ev('running', '2026-11-14T10:00:00Z'), status: 'JOINED' }, // started 2 h ago, ends 13:00
      ],
      [],
      now,
    );
    expect(groups.upcoming.map((e) => e.id)).toEqual(['soon', 'running']);
  });

  it('uses endsAt when the event has one', () => {
    const groups = groupMyEvents([{ event: ev('long', '2026-11-14T01:00:00Z', '2026-11-14T13:00:00Z'), status: 'JOINED' }], [], now);
    expect(groups.upcoming).toHaveLength(1);
  });

  it('sorts attended events newest first and ignores other statuses', () => {
    const groups = groupMyEvents(
      [
        { event: ev('a', '2026-11-01T18:00:00Z'), status: 'ATTENDED' },
        { event: ev('b', '2026-11-10T18:00:00Z'), status: 'ATTENDED' },
        { event: ev('c', '2026-11-12T18:00:00Z'), status: 'NO_SHOW' },
        { event: ev('d', '2026-11-20T18:00:00Z'), status: 'BANNED' },
      ],
      [],
      now,
    );
    expect(groups.attended.map((e) => e.id)).toEqual(['b', 'a']);
    expect(groups.upcoming).toEqual([]);
  });

  it('hides organised events that are over', () => {
    const groups = groupMyEvents([], [ev('past', '2026-11-01T18:00:00Z'), ev('next', '2026-11-20T18:00:00Z')], now);
    expect(groups.organizing.map((e) => e.id)).toEqual(['next']);
  });
});

describe('reliability labels', () => {
  it('formats points with a real minus sign', () => {
    expect(formatPoints(5)).toBe('+5');
    expect(formatPoints(-10)).toBe('−10');
    expect(formatPoints(0)).toBe('0');
  });

  it('names every reason', () => {
    expect(reasonLabel('ATTENDED')).toBe('Attended');
    expect(reasonLabel('NO_SHOW')).toBe('Missed the event');
    expect(reasonLabel('LATE_CANCEL')).toBe('Left late');
  });
});
