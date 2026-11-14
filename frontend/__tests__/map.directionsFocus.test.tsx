// Directions focus mode: while directions are shown every map filter is off and greyed out, so only the user, the
// route, the live vehicles of its lines and the destination are on the map. Closing the directions brings the filters back.
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';

import * as endpoints from '@/api/endpoints.transit';
import type { RouteLeg } from '@/api/types.routing';
import type { TransitVehicle, TransitVehicles } from '@/api/types.transit';
import MapScreen from '@/app/(tabs)/map';
import { INITIAL_MAP_FILTERS, mapFiltersReducer, visibleLayers } from '@/features/map/mapFilters';
import { LegVehicles } from '@/features/transit/LegVehicles';
import { VEHICLES_REFRESH_MS } from '@/hooks/useTransit';

import { renderScreen } from './testUtils';

/** Moves the map to the centre with the given span and waits for the debounced bbox. */
async function moveTo(span: number) {
  await act(async () => {
    fireEvent(screen.getByTestId('main-map'), 'regionChangeComplete', { latitude: 45.7537, longitude: 21.2257, latitudeDelta: span, longitudeDelta: span });
    await new Promise((r) => setTimeout(r, 400));
  });
}

/** Long-press on the map: drops a destination and opens directions. */
function longPress(lat: number, lon: number) {
  fireEvent(screen.getByTestId('main-map'), 'longPress', { nativeEvent: { coordinate: { latitude: lat, longitude: lon } } });
}

const transportLayerMarkers = () => screen.queryAllByTestId(/^(shape-line-|stop-marker-)/);
const eventMarkers = () => screen.queryAllByTestId(/^(event-marker-|cluster-)/);

describe('visibleLayers', () => {
  it('passes the filters through when no directions are shown', () => {
    const f = { ...INITIAL_MAP_FILTERS, transitOn: true };
    expect(visibleLayers(f, false)).toBe(f);
  });

  it('turns every layer off while directions are shown, keeping the chosen categories for later', () => {
    const f = { placesOn: true, categories: ['cafe' as const], eventsOn: true, transitOn: false };
    expect(visibleLayers(f, true)).toEqual({ placesOn: false, categories: ['cafe'], eventsOn: false, transitOn: false });
    expect(f.placesOn).toBe(true); // the user's own choice is untouched
  });

  it('turns Transport off too while directions are shown (Transport on is exclusive: nothing else is on)', () => {
    const f = mapFiltersReducer(INITIAL_MAP_FILTERS, { type: 'transport' });
    expect(visibleLayers(f, true)).toMatchObject({ placesOn: false, eventsOn: false, transitOn: false });
    expect(f.transitOn).toBe(true);
  });
});

describe('MapScreen while directions are shown', () => {
  it('hides places, events and the transport network, greys out the filters, and restores them on close', async () => {
    renderScreen(<MapScreen />);
    await moveTo(0.02);
    await waitFor(() => expect(eventMarkers().length).toBeGreaterThan(0));
    // Transport is exclusive: places and events go, the network comes.
    fireEvent.press(screen.getByTestId('chip-transit'));
    await waitFor(() => expect(transportLayerMarkers().length).toBeGreaterThan(0));
    await waitFor(() => expect(eventMarkers()).toHaveLength(0));
    expect(screen.queryAllByTestId(/^place-marker-/)).toHaveLength(0);

    longPress(45.7275, 21.2355);
    expect(await screen.findByTestId('destination-marker')).toBeTruthy();
    await waitFor(() => expect(transportLayerMarkers()).toHaveLength(0));
    expect(eventMarkers()).toHaveLength(0);
    expect(screen.queryAllByTestId(/^place-marker-/)).toHaveLength(0);
    expect(screen.getByTestId('filters-off-hint')).toBeTruthy();
    expect(screen.queryByTestId('zoom-hint')).toBeNull();

    // The chips are disabled: pressing one changes nothing.
    const transport = screen.getByTestId('chip-transit');
    expect(transport.props.accessibilityState).toMatchObject({ disabled: true, selected: false });
    fireEvent.press(transport);
    expect(transportLayerMarkers()).toHaveLength(0);

    // Closing the directions brings the user's filters back (transport was on).
    fireEvent.press(screen.getByLabelText('Close panel'));
    await waitFor(() => expect(screen.queryByTestId('destination-marker')).toBeNull());
    expect(screen.queryByTestId('filters-off-hint')).toBeNull();
    await waitFor(() => expect(transportLayerMarkers().length).toBeGreaterThan(0));
    expect(screen.getByTestId('chip-transit').props.accessibilityState).toMatchObject({ disabled: false, selected: true });
    expect(eventMarkers()).toHaveLength(0); // still Transport alone
    expect(screen.queryAllByTestId(/^place-marker-/)).toHaveLength(0);

    // Turning Transport off brings the filters from before it back (places and events).
    fireEvent.press(screen.getByTestId('chip-transit'));
    await waitFor(() => expect(transportLayerMarkers()).toHaveLength(0));
    await waitFor(() => expect(eventMarkers().length).toBeGreaterThan(0));
    await waitFor(() => expect(screen.queryAllByTestId(/^place-marker-/).length).toBeGreaterThan(0));
  });

  it('still draws the route and the live vehicles of its ride lines', async () => {
    renderScreen(<MapScreen />);
    await moveTo(0.02);
    longPress(45.7275, 21.2355);
    await waitFor(() => expect(screen.queryAllByTestId(/^route-line-/).length).toBeGreaterThan(0));
    await waitFor(() => expect(screen.queryAllByTestId(/^leg-vehicle-|^vehicle-marker-/).length).toBeGreaterThan(0));
  });

  it('keeps every live vehicle of the route lines drawn when the map is zoomed far into one corner', async () => {
    renderScreen(<MapScreen />);
    await moveTo(0.02);
    longPress(45.7275, 21.2355);
    await waitFor(() => expect(screen.queryAllByTestId(/^leg-vehicle-marker-/).length).toBeGreaterThan(1));
    const before = screen.queryAllByTestId(/^leg-vehicle-marker-/).length;
    // A tiny view in the north-west: no vehicle of the line is in it, yet they are all still drawn (no in-view filter).
    await act(async () => {
      fireEvent(screen.getByTestId('main-map'), 'regionChangeComplete', { latitude: 45.8, longitude: 21.15, latitudeDelta: 0.001, longitudeDelta: 0.001 });
      await new Promise((r) => setTimeout(r, 400));
    });
    expect(screen.queryAllByTestId(/^leg-vehicle-marker-/)).toHaveLength(before);
  });
});

describe('leg vehicles keep refreshing while a route is shown', () => {
  /** A live tram of line 1 at a point. */
  const tram = (id: string, lat: number, lon: number): TransitVehicle => ({
    id, route: '1', routeName: '1', type: 'TRAM', color: null, lat, lon, bearing: null, speedKmh: null, headsign: null, nextStop: null, accessible: false, reportedAt: '2026-11-14T16:08:00Z',
  });
  /** One /transit/vehicles?route=1 answer. */
  const answer = (vehicles: TransitVehicle[]): TransitVehicles => ({ route: '1', updatedAt: '2026-11-14T16:08:00Z', stale: false, vehicles });
  const legs: RouteLeg[] = [
    { mode: 'TRAM', route: '1', headsign: null, from: { name: 'A', lat: 45.755, lon: 21.22 }, to: { name: 'B', lat: 45.765, lon: 21.22 }, startsAt: null, endsAt: null, durationMinutes: 5, polyline: null },
  ];

  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it('refetches the ride line every VEHICLES_REFRESH_MS, moves its vehicles and drops the gone ones', async () => {
    const spy = jest
      .spyOn(endpoints, 'getTransitVehicles')
      .mockResolvedValueOnce(answer([tram('t1', 45.755, 21.22), tram('t2', 45.76, 21.22)]))
      .mockResolvedValue(answer([tram('t1', 45.757, 21.221)]));
    renderScreen(<LegVehicles legs={legs} onSelect={jest.fn()} />);
    await waitFor(() => expect(screen.getByTestId('leg-vehicle-marker-t2')).toBeTruthy());
    expect(screen.getByTestId('leg-vehicle-marker-t1').props.coordinate).toMatchObject({ latitude: 45.755, longitude: 21.22 });
    expect(spy).toHaveBeenCalledTimes(1);
    await act(async () => {
      jest.advanceTimersByTime(VEHICLES_REFRESH_MS);
    });
    await waitFor(() => expect(screen.queryByTestId('leg-vehicle-marker-t2')).toBeNull());
    expect(spy).toHaveBeenCalledTimes(2);
    expect(spy).toHaveBeenLastCalledWith('1');
    expect(screen.getByTestId('leg-vehicle-marker-t1').props.coordinate).toMatchObject({ latitude: 45.757, longitude: 21.221 });
  });
});
