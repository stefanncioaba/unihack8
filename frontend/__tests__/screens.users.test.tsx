// User search, public profile, my profile, map and AI tabs.
import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import AiScreen from '@/app/(tabs)/ai';
import MapScreen from '@/app/(tabs)/map';
import ProfileScreen from '@/app/(tabs)/profile';
import { LocationProvider } from '@/features/location/LocationProvider';
import UserSearchScreen from '@/app/users/search';
import PublicProfileScreen from '@/app/users/[id]';

import { fakeAuth, IDS, mockRouter, renderScreen, setParams } from './testUtils';

describe('UserSearchScreen', () => {
  it('invites the user to type before searching', () => {
    renderScreen(<UserSearchScreen />);
    expect(screen.getByText('Look someone up')).toBeTruthy();
  });

  it('finds users by username prefix and opens their profile', async () => {
    renderScreen(<UserSearchScreen />);
    fireEvent.changeText(screen.getByLabelText('Search by username'), 'ste');
    expect(await screen.findByText('stefan')).toBeTruthy();
    expect(screen.getByText('stella_99')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Open profile of stella_99' }));
    expect(mockRouter.push).toHaveBeenCalledWith(`/users/${IDS.stella}`);
  });

  it('says when nobody matches', async () => {
    renderScreen(<UserSearchScreen />);
    fireEvent.changeText(screen.getByLabelText('Search by username'), 'zzz');
    expect(await screen.findByText('No one found')).toBeTruthy();
  });
});

describe('PublicProfileScreen', () => {
  it('shows username, reliability score and attended events', async () => {
    setParams({ id: IDS.stella });
    renderScreen(<PublicProfileScreen />);
    expect(await screen.findByText('stella_99')).toBeTruthy();
    expect(screen.getByLabelText('Reliability score 90')).toBeTruthy();
    expect(screen.getByText('Events attended')).toBeTruthy();
    expect(screen.getByText('Autumn photo walk')).toBeTruthy();
    expect(screen.getByText('Retro gaming evening')).toBeTruthy();
  });

  it('explains how the score works', async () => {
    setParams({ id: IDS.stella });
    renderScreen(<PublicProfileScreen />);
    fireEvent.press(await screen.findByRole('button', { name: 'How the score works' }));
    expect(screen.getByTestId('score-explainer')).toBeTruthy();
  });

  it('shows an empty state for someone who attended nothing', async () => {
    setParams({ id: '55555555-5555-4555-8555-555555555555' }); // maria_c
    renderScreen(<PublicProfileScreen />);
    expect(await screen.findByText('maria_c')).toBeTruthy();
    expect(screen.getByText('No events yet')).toBeTruthy();
  });

  it('shows an error for an unknown user', async () => {
    setParams({ id: 'unknown' });
    renderScreen(<PublicProfileScreen />);
    expect(await screen.findByTestId('error-state')).toBeTruthy();
  });
});

describe('ProfileScreen', () => {
  it('shows my username, score and the default avatar', async () => {
    renderScreen(<ProfileScreen />);
    expect(await screen.findByText('demo_user')).toBeTruthy();
    expect(screen.getByLabelText('Reliability score 100')).toBeTruthy();
    expect(screen.getByTestId('default-avatar')).toBeTruthy();
  });

  it('signs out', async () => {
    const { auth } = renderScreen(<ProfileScreen />);
    fireEvent.press(await screen.findByRole('button', { name: 'Sign out' }));
    await waitFor(() => expect(auth.signOut).toHaveBeenCalled());
  });

  it('shows the error when signing out fails', async () => {
    renderScreen(<ProfileScreen />, fakeAuth({ signOut: jest.fn().mockRejectedValue(new Error('No connection')) }));
    fireEvent.press(await screen.findByRole('button', { name: 'Sign out' }));
    expect(await screen.findByText('No connection')).toBeTruthy();
  });

  it('opens the people search', async () => {
    renderScreen(<ProfileScreen />);
    fireEvent.press(await screen.findByRole('button', { name: 'Find people' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/users/search');
  });
});

describe('MapScreen', () => {
  it('renders the map without a pin by default', () => {
    renderScreen(<MapScreen />);
    expect(screen.getByTestId('main-map')).toBeTruthy();
    expect(screen.queryByTestId('focus-marker')).toBeNull();
  });

  it('drops a pin for the event shown from the details page', () => {
    setParams({ lat: '45.7489', lon: '21.2318', title: 'Board games night' });
    renderScreen(<MapScreen />);
    expect(screen.getByTestId('focus-marker')).toBeTruthy();
    expect(screen.getByText('Board games night')).toBeTruthy();
  });

  it('ignores invalid coordinates', () => {
    setParams({ lat: '999', lon: 'abc' });
    renderScreen(<MapScreen />);
    expect(screen.queryByTestId('focus-marker')).toBeNull();
  });

  it('locates the user', async () => {
    // Not enabled, so the only location request is the button press.
    renderScreen(
      <LocationProvider enabled={false}>
        <MapScreen />
      </LocationProvider>,
    );
    fireEvent.press(screen.getByRole('button', { name: 'Locate me' }));
    await waitFor(() => expect(require('expo-location').getCurrentPositionAsync).toHaveBeenCalled());
  });
});

describe('AiScreen', () => {
  it('renders the page frame', () => {
    renderScreen(<AiScreen />);
    expect(screen.getByText('Ask about the city')).toBeTruthy();
  });
});
