// Map layers: places (14.2) and events (14.3), plus the mock /places and /events?bbox routes they use.
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react-native';

import MapScreen from '@/app/(tabs)/map';
import { mockRequest } from '@test/mocks';
import { placeId } from '@test/mocks/placesSeed';

import { IDS, mockRouter, renderScreen, setParams } from './testUtils';

const call = (path: string, query: Record<string, unknown> = {}) => mockRequest('GET', path, query) as Promise<any>;
const markers = (kind: 'place' | 'event') => screen.queryAllByTestId(new RegExp(`^${kind}-marker-`));
const clusters = () => screen.queryAllByTestId(/^cluster-/);

/** Zooms the mocked map in (about 1.1 km across; the area is rounded to 3 decimals, so stay clearly under the threshold) so pins are no longer grouped, and waits for the debounce + reload. */
async function zoomIn() {
  await act(async () => {
    fireEvent(screen.getByTestId('main-map'), 'regionChangeComplete', { latitude: 45.7537, longitude: 21.2257, latitudeDelta: 0.01, longitudeDelta: 0.01 });
    await new Promise((r) => setTimeout(r, 400));
  });
}

describe('mock /places', () => {
  it('filters by category (repeatable or comma-separated) and name', async () => {
    const cafes = await call('/places', { category: 'cafe' });
    expect(cafes.items.every((p: any) => p.category === 'cafe')).toBe(true);
    expect(cafes.totalItems).toBe(4);
    const two = await call('/places', { category: ['cafe', 'bar'] });
    expect(new Set(two.items.map((p: any) => p.category))).toEqual(new Set(['cafe', 'bar']));
    expect((await call('/places', { q: 'NAPOLI' })).items.map((p: any) => p.name)).toEqual(['Pizzeria Napoli']);
  });

  it('filters by bbox and sorts by distance with near + radius', async () => {
    const inBox = await call('/places', { bbox: '21.22,45.75,21.23,45.76', size: 100 });
    expect(inBox.items.length).toBeGreaterThan(3);
    expect(inBox.items.every((p: any) => p.lon >= 21.22 && p.lon <= 21.23 && p.lat >= 45.75 && p.lat <= 45.76)).toBe(true);

    const near = await call('/places', { near: '45.7537,21.2257', radius: 500 });
    const d = near.items.map((p: any) => p.distanceMeters);
    expect(d[0]).toBeLessThan(100);
    expect([...d].sort((a, b) => a - b)).toEqual(d);
    expect(Math.max(...d)).toBeLessThanOrEqual(500);
  });

  it('answers the documented errors and the detail endpoint', async () => {
    await expect(call('/places', { category: 'zoo' })).rejects.toMatchObject({ status: 400, code: 'VALIDATION_FAILED' });
    await expect(call('/places', { radius: 100 })).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
    await expect(call('/places', { bbox: 'oops' })).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
    const detail = await call(`/places/${placeId(0)}`);
    expect(detail).toMatchObject({ name: 'Pizzeria Napoli', openingHours: 'Mo-Su 11:00-23:00', tags: { cuisine: 'pizza' } });
    await expect(call('/places/unknown')).rejects.toMatchObject({ status: 404 });
  });
});

describe('mock /events with bbox', () => {
  it('only returns events with coordinates inside the box', async () => {
    const all = await call('/events', { size: 100 });
    const some = await call('/events', { bbox: '21.228,45.745,21.235,45.752', size: 100 });
    expect(some.items.length).toBeGreaterThan(0);
    expect(some.items.length).toBeLessThan(all.items.length);
    expect(some.items.every((e: any) => e.lon >= 21.228 && e.lon <= 21.235 && e.lat >= 45.745 && e.lat <= 45.752)).toBe(true);
    await expect(call('/events', { bbox: 'x' })).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
  });
});

describe('MapScreen opened from elsewhere ("Show on map")', () => {
  it('opens the place panel when a placeId is passed, without an extra pin', async () => {
    setParams({ lat: '45.7537', lon: '21.2257', title: 'Pizzeria Napoli', placeId: placeId(0), at: '1' });
    renderScreen(<MapScreen />);
    const panel = within(await screen.findByTestId('place-panel'));
    expect(await panel.findByText('Pizzeria Napoli')).toBeTruthy();
    expect(screen.queryByTestId('focus-marker')).toBeNull();
  });

  it('opens the event panel when an eventId is passed', async () => {
    setParams({ lat: '45.7489', lon: '21.2318', title: 'Board games night', eventId: IDS.boardGames, at: '1' });
    renderScreen(<MapScreen />);
    const panel = within(await screen.findByTestId('event-panel'));
    expect(await panel.findByText('Board games night')).toBeTruthy();
  });

  it('keeps the plain pin when only coordinates are passed', () => {
    setParams({ lat: '45.7489', lon: '21.2318', title: 'Somewhere' });
    renderScreen(<MapScreen />);
    expect(screen.getByTestId('focus-marker')).toBeTruthy();
    expect(screen.queryByTestId('map-panel')).toBeNull();
  });
});

describe('MapScreen layers', () => {
  it('shows place and event pins for the visible area', async () => {
    renderScreen(<MapScreen />);
    await zoomIn();
    await waitFor(() => expect(markers('place').length).toBeGreaterThan(10));
    await waitFor(() => expect(markers('event').length).toBeGreaterThan(3));
  });

  it('filters places by category chips and resets with "All places"', async () => {
    renderScreen(<MapScreen />);
    await zoomIn();
    await waitFor(() => expect(markers('place').length).toBeGreaterThan(10));
    fireEvent.press(screen.getByRole('button', { name: 'Cafés' }));
    await waitFor(() => expect(markers('place').length).toBe(4));
    fireEvent.press(screen.getByRole('button', { name: 'Parks' }));
    await waitFor(() => expect(markers('place').length).toBe(5));
    fireEvent.press(screen.getByRole('button', { name: 'All places' }));
    await waitFor(() => expect(markers('place').length).toBeGreaterThan(10));
  });

  it('opens a place panel with details and a Directions button', async () => {
    renderScreen(<MapScreen />);
    await zoomIn();
    fireEvent.press(await screen.findByTestId(`place-marker-${placeId(0)}`));
    const panel = within(await screen.findByTestId('place-panel'));
    expect(panel.getByText('Pizzeria Napoli')).toBeTruthy();
    expect(panel.getByText('Mo-Su 11:00-23:00')).toBeTruthy();
    expect(panel.getByText('Strada Alba Iulia 2')).toBeTruthy();
    expect(panel.getByText('Cuisine: pizza')).toBeTruthy();

    fireEvent.press(panel.getByRole('button', { name: 'Directions' }));
    expect(await screen.findByText(/Directions to Pizzeria Napoli/)).toBeTruthy();
  });

  it('says when a place has no opening hours listed', async () => {
    renderScreen(<MapScreen />);
    await zoomIn();
    fireEvent.press(await screen.findByTestId(`place-marker-${placeId(18)}`)); // Sala Capitol
    expect(await screen.findByText('Opening hours not listed')).toBeTruthy();
  });

  it('opens an event panel and navigates to the event', async () => {
    renderScreen(<MapScreen />);
    await zoomIn();
    fireEvent.press(await screen.findByTestId(`event-marker-${IDS.artWalk}`));
    const panel = within(await screen.findByTestId('event-panel'));
    expect(await panel.findByText('Art walk through the old town')).toBeTruthy();
    fireEvent.press(panel.getByRole('button', { name: 'Open event' }));
    expect(mockRouter.push).toHaveBeenCalledWith(`/events/${IDS.artWalk}`);
  });

  it('hides event pins with the Events toggle', async () => {
    renderScreen(<MapScreen />);
    await zoomIn();
    await waitFor(() => expect(markers('event').length).toBeGreaterThan(3));
    fireEvent.press(screen.getByTestId('chip-events'));
    await waitFor(() => expect(markers('event')).toHaveLength(0));
    expect(markers('place').length).toBeGreaterThan(0);
    fireEvent.press(screen.getByTestId('chip-events'));
    await waitFor(() => expect(markers('event').length).toBeGreaterThan(3));
  });

  it('closes the panel when the empty map is tapped, but not on a marker tap', async () => {
    renderScreen(<MapScreen />);
    await zoomIn();
    fireEvent.press(await screen.findByTestId(`place-marker-${placeId(0)}`));
    await screen.findByTestId('place-panel');
    fireEvent(screen.getByTestId('main-map'), 'press', { nativeEvent: { action: 'marker-press' } });
    expect(screen.getByTestId('map-panel')).toBeTruthy();
    fireEvent(screen.getByTestId('main-map'), 'press', { nativeEvent: { coordinate: { latitude: 45.7, longitude: 21.2 } } });
    expect(screen.queryByTestId('map-panel')).toBeNull();
  });

  it('groups nearby pins into numbered clusters when zoomed out, and splits them when zoomed in', async () => {
    renderScreen(<MapScreen />);
    await waitFor(() => expect(clusters().length).toBeGreaterThan(0));
    await zoomIn();
    await waitFor(() => expect(clusters()).toHaveLength(0));
    expect(markers('place').length).toBeGreaterThan(10);
  });

  it('asks the user to zoom in instead of loading places when zoomed far out', async () => {
    renderScreen(<MapScreen />);
    await waitFor(() => expect(clusters().length).toBeGreaterThan(0));
    expect(screen.queryByTestId('zoom-hint')).toBeNull();
    act(() => {
      fireEvent(screen.getByTestId('main-map'), 'regionChangeComplete', { latitude: 45.75, longitude: 21.22, latitudeDelta: 0.5, longitudeDelta: 0.5 });
    });
    expect(await screen.findByTestId('zoom-hint')).toBeTruthy();
    await waitFor(() => expect(markers('place')).toHaveLength(0));
  });
});
