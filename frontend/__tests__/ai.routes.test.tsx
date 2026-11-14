// AI route cards (PLAN 18.4): "Go" only for routes that start at the user, "Show route on map" on every card, and
// no journey without location permission (18.7).
import { fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import * as Location from 'expo-location';

import type { ChatRoute } from '@/api/types.ai';
import AiScreen from '@/app/(tabs)/ai';
import { parseRouteParams, routeParams } from '@/features/journey/navigation';
import { LocationProvider } from '@/features/location/LocationProvider';

import { mockRouter, renderScreen } from './testUtils';

/** Types a message and presses send. */
function say(text: string) {
  fireEvent.changeText(screen.getByLabelText('Message'), text);
  fireEvent.press(screen.getByRole('button', { name: 'Send message' }));
}

const permission = Location.requestForegroundPermissionsAsync as jest.Mock;
const currentPermission = Location.getForegroundPermissionsAsync as jest.Mock;

/** The chat with a real location provider (the mocked GPS), so answers carry the user's position. */
function renderChat() {
  return renderScreen(
    <LocationProvider>
      <AiScreen />
    </LocationProvider>,
  );
}

afterEach(() => {
  permission.mockResolvedValue({ status: 'granted' });
  currentPermission.mockResolvedValue({ status: 'granted' });
});

describe('route cards under an AI answer', () => {
  it('shows a route that starts at the user with "Go" and "Show route on map"', async () => {
    renderChat();
    await screen.findByText('Ask about the city');
    say('How do I get to a coffee place?');
    const card = within(await screen.findByTestId('result-route-0'));
    expect(card.getByText(/^Walking · \d+ min · /)).toBeTruthy();
    expect(card.getByRole('button', { name: 'Go' })).toBeTruthy();
    expect(card.getByRole('button', { name: 'Show route on map' })).toBeTruthy();
  });

  it('has no "Go" for a route from another place (the university)', async () => {
    renderChat();
    await screen.findByText('Ask about the city');
    say('How do I get from the university to a coffee place?');
    const card = within(await screen.findByTestId('result-route-0'));
    expect(card.getByText(/from West University/)).toBeTruthy();
    expect(card.queryByRole('button', { name: 'Go' })).toBeNull();
    expect(card.getByRole('button', { name: 'Show route on map' })).toBeTruthy();
  });

  it('shows no route cards when the answer planned no route', async () => {
    renderChat();
    await screen.findByText('Ask about the city');
    say('Where can I eat a cheap pizza?');
    expect(await screen.findByTestId('result-cards')).toBeTruthy();
    expect(screen.queryByTestId('route-cards')).toBeNull();
  });

  it('"Go" opens the Map tab in journey mode with the destination and mode', async () => {
    renderChat();
    await screen.findByText('Ask about the city');
    say('How do I get to a coffee place?');
    const card = within(await screen.findByTestId('result-route-0'));
    fireEvent.press(card.getByRole('button', { name: 'Go' }));
    await waitFor(() => expect(mockRouter.push).toHaveBeenCalled());
    const { pathname, params } = mockRouter.push.mock.calls[0][0];
    expect(pathname).toBe('/map');
    expect(parseRouteParams(params)).toMatchObject({ go: true, mode: 'WALK', fromName: 'Your location' });
  });

  it('"Show route on map" opens a preview, not a journey', async () => {
    renderChat();
    await screen.findByText('Ask about the city');
    say('How do I get from the university to a coffee place?');
    fireEvent.press(within(await screen.findByTestId('result-route-0')).getByRole('button', { name: 'Show route on map' }));
    const { params } = mockRouter.push.mock.calls[0][0];
    expect(parseRouteParams(params)).toMatchObject({ go: false, fromName: 'West University' });
  });

  it('"Go" asks for location permission and does not start without it', async () => {
    currentPermission.mockResolvedValue({ status: 'denied' });
    // Granted for the app's position at start, then refused when "Go" asks again.
    permission.mockResolvedValueOnce({ status: 'granted' }).mockResolvedValue({ status: 'denied' });
    renderChat();
    await screen.findByText('Ask about the city');
    say('How do I get to a coffee place?');
    fireEvent.press(within(await screen.findByTestId('result-route-0')).getByRole('button', { name: 'Go' }));
    expect(await screen.findByTestId('route-location-needed')).toBeTruthy();
    expect(permission).toHaveBeenCalledTimes(2);
    expect(mockRouter.push).not.toHaveBeenCalled();
  });
});

describe('route params', () => {
  const route: ChatRoute = {
    from: { lat: 45.7472, lon: 21.231, name: 'West University' },
    to: { lat: 45.7537, lon: 21.2257, name: null },
    mode: 'TRANSIT',
    durationMinutes: 12,
    distanceMeters: 1300,
    startsFromUser: false,
    leaveNow: null,
  };

  it('round-trips a route', () => {
    expect(parseRouteParams(routeParams(route, false, 1))).toEqual({
      go: false,
      from: { lat: 45.7472, lon: 21.231 },
      fromName: 'West University',
      to: { lat: 45.7537, lon: 21.2257 },
      toName: null,
      mode: 'TRANSIT',
    });
  });

  it('ignores missing or malformed route params', () => {
    expect(parseRouteParams({})).toBeNull();
    expect(parseRouteParams({ ...routeParams(route, true), toLat: 'abc' })).toBeNull();
  });
});
