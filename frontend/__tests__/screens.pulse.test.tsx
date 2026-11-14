// Neighbourhood Pulse: text helpers, the screen with mock data, and the Home entry point.
import { fireEvent, screen, waitFor, within } from '@testing-library/react-native';

import type { NeighbourhoodPulse } from '@/api/types.neighbourhoods';
import HomeScreen from '@/app/(tabs)/index';
import NeighbourhoodPulseScreen from '@/app/pulse/index';
import { neighbourhoodPhoto, NEIGHBOURHOOD_PHOTOS } from '@/features/neighbourhoods/photos';
import { eventsLine, eventWhen, peopleLine, placesLine, transitLine } from '@/features/neighbourhoods/pulseFormat';
import * as mocks from '@test/mocks';
import { mockPulseAreas } from '@test/mocks/routes/neighbourhoods';

import { IDS, mockRouter, renderScreen } from './testUtils';

/** A mock area with some fields replaced. */
function area(overrides: Partial<NeighbourhoodPulse> = {}): NeighbourhoodPulse {
  return { ...mockPulseAreas()[0], ...overrides };
}

describe('pulse text lines', () => {
  it('describes events now, tonight and free spots', () => {
    expect(eventsLine(area())).toBe('1 event now · 2 tonight · 6 free spots');
    expect(eventsLine(area({ events: { nowCount: 0, tonightCount: 1, freeSpots: 0, highlights: [] } }))).toBe('1 event tonight');
    expect(eventsLine(area({ events: { nowCount: 0, tonightCount: 0, freeSpots: 0, highlights: [] } }))).toBe('No events tonight');
  });

  it('shows "Now" or the start time, with spots for limited events', () => {
    const [running, later] = area().events.highlights;
    expect(eventWhen(running)).toBe('Now · 4 spots left');
    expect(eventWhen(later)).toMatch(/^\d{2}:\d{2}$/);
    expect(eventWhen({ ...running, spotsLeft: 0 })).toBe('Now · full');
    expect(eventWhen({ ...running, spotsLeft: 1 })).toBe('Now · 1 spot left');
  });

  it('lists lines and vehicles, or why transit is missing', () => {
    expect(transitLine(area())).toBe('Lines 1, 2, 8, E2 · 3 vehicles nearby');
    const t = area().transit;
    expect(transitLine(area({ transit: { ...t, lines: ['1'], liveVehicles: 1 } }))).toBe('Line 1 · 1 vehicle nearby');
    expect(transitLine(area({ transit: { ...t, lines: ['1', '2', '3', '4', '5', '6', '7', '8'] } }))).toMatch(/^Lines 1, 2, 3, 4, 5, 6 \+2 ·/);
    expect(transitLine(area({ transit: { ...t, available: false } }))).toBe('Live transit unavailable right now');
    expect(transitLine(area({ transit: { ...t, lines: [] } }))).toBe('No STPT stops in this area');
  });

  it('counts open places with their top categories', () => {
    expect(placesLine(area())).toBe('64 of 120 places open now · Restaurants, Cafés');
    expect(placesLine(area({ places: { total: 0, openNow: 0, topCategories: [] } }))).toBe('No places listed');
  });

  it('counts people going and the reliable ones', () => {
    expect(peopleLine(area())).toBe('9 going out · 7 reliable');
    expect(peopleLine(area({ people: { going: 0, reliableGoing: 0 } }))).toBe('Nobody has joined an event here yet');
  });
});

describe('neighbourhood photos', () => {
  it('has a photo with a credit for every area the backend knows', () => {
    for (const id of ['cetate', 'fabric', 'iosefin', 'elisabetin', 'mehala', 'complex', 'circumvalatiunii', 'fratelia', 'soarelui']) {
      expect(neighbourhoodPhoto(id)?.credit).toMatch(/CC BY/);
    }
    expect(Object.keys(NEIGHBOURHOOD_PHOTOS)).toHaveLength(9);
    expect(neighbourhoodPhoto('unknown')).toBeNull();
  });
});

describe('NeighbourhoodPulseScreen', () => {
  it('shows a card per area with events, transit, alert, places and people', async () => {
    renderScreen(<NeighbourhoodPulseScreen />);
    const card = within(await screen.findByTestId('pulse-card-cetate'));
    expect(card.getByText('Cetate')).toBeTruthy();
    expect(card.getByText('Busy')).toBeTruthy();
    expect(card.getByText('Board games night')).toBeTruthy();
    expect(card.getByText('Now · 4 spots left')).toBeTruthy();
    expect(card.getByText('Lines 1, 2, 8, E2 · 3 vehicles nearby')).toBeTruthy();
    expect(card.getByText('Line 8 diverted')).toBeTruthy();
    expect(card.getByText('9 going out · 7 reliable')).toBeTruthy();
    expect(card.getByTestId('pulse-photo-cetate')).toBeTruthy();
    expect(screen.getByText(/^Live · updated \d{2}:\d{2}$/)).toBeTruthy();
  });

  it('keeps the order from the backend (busiest first)', async () => {
    renderScreen(<NeighbourhoodPulseScreen />);
    await screen.findByTestId('pulse-card-cetate');
    const names = screen.getAllByRole('header').map((h) => h.props.children);
    expect(names.indexOf('Cetate')).toBeLessThan(names.indexOf('Fabric'));
  });

  it('says when live transit is down and shows areas without a photo', async () => {
    renderScreen(<NeighbourhoodPulseScreen />);
    const fabric = within(await screen.findByTestId('pulse-card-fabric'));
    expect(fabric.getByText('Live transit unavailable right now')).toBeTruthy();
    const unknown = within(screen.getByTestId('pulse-card-somewhere-new'));
    expect(unknown.getByText('Quiet')).toBeTruthy();
    expect(unknown.queryByTestId('pulse-photo-somewhere-new')).toBeNull();
  });

  it('opens the event and the map', async () => {
    renderScreen(<NeighbourhoodPulseScreen />);
    fireEvent.press(await screen.findByLabelText('Open Board games night'));
    expect(mockRouter.push).toHaveBeenCalledWith(`/events/${IDS.boardGames}`);
    fireEvent.press(screen.getByLabelText('Show Cetate on the map'));
    expect(mockRouter.push).toHaveBeenCalledWith(
      expect.objectContaining({ pathname: '/map', params: expect.objectContaining({ lat: '45.7568', lon: '21.229', title: 'Cetate' }) }),
    );
  });

  it('shows an error with retry when the request fails', async () => {
    const spy = jest.spyOn(mocks, 'mockRequest').mockRejectedValue(new Error('boom'));
    renderScreen(<NeighbourhoodPulseScreen />);
    expect(await screen.findByText(/try again|retry/i)).toBeTruthy();
    spy.mockRestore();
  });
});

describe('Home entry point', () => {
  it('opens the pulse from the header', async () => {
    renderScreen(<HomeScreen />);
    fireEvent.press(await screen.findByLabelText('Neighbourhood pulse'));
    await waitFor(() => expect(mockRouter.push).toHaveBeenCalledWith('/pulse'));
  });
});
