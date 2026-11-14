// Directions focus mode: while directions are shown every map filter is off and greyed out, so only the user, the
// route, the live vehicles of its lines and the destination are on the map. Closing the directions brings the filters back.
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';

import MapScreen from '@/app/(tabs)/map';
import { INITIAL_MAP_FILTERS, mapFiltersReducer, visibleLayers } from '@/features/map/mapFilters';

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
});
