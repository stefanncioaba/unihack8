// Map tab filters: the layer reducer, the chip row order, Chip colours, and the screen hiding / showing layers.
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import MapScreen from '@/app/(tabs)/map';
import { MapFilterBar } from '@/features/map/MapFilterBar';
import {
  INITIAL_MAP_FILTERS,
  allPlacesSelected,
  categorySelected,
  mapFiltersReducer,
  type MapFilterAction,
  type MapFilters,
} from '@/features/map/mapFilters';
import { Chip, MAP_CHIP_BG, chipColors, chipStyle as chipPressableStyle } from '@/ui/Chip';
import { colors } from '@/ui/theme';

import { placeId } from '@test/mocks/placesSeed';

import { renderScreen, setParams } from './testUtils';

const run = (start: MapFilters, ...actions: MapFilterAction[]) => actions.reduce(mapFiltersReducer, start);
const ALL: MapFilterAction = { type: 'allPlaces' };
const EVENTS: MapFilterAction = { type: 'events' };
const TRANSPORT: MapFilterAction = { type: 'transport' };
const cafe: MapFilterAction = { type: 'category', category: 'cafe' };
const bar: MapFilterAction = { type: 'category', category: 'bar' };

describe('mapFiltersReducer', () => {
  it('starts with all places and events on, transport off', () => {
    expect(INITIAL_MAP_FILTERS).toEqual({ placesOn: true, categories: [], eventsOn: true, transitOn: false });
    expect(allPlacesSelected(INITIAL_MAP_FILTERS)).toBe(true);
  });

  it('turns places off when "All places" is pressed while selected and another layer is on', () => {
    const f = run(INITIAL_MAP_FILTERS, ALL);
    expect(f.placesOn).toBe(false);
    expect(allPlacesSelected(f)).toBe(false);
  });

  it('does nothing when "All places" would leave the map empty', () => {
    const onlyPlaces = run(INITIAL_MAP_FILTERS, EVENTS);
    expect(onlyPlaces).toMatchObject({ placesOn: true, eventsOn: false, transitOn: false });
    expect(mapFiltersReducer(onlyPlaces, ALL)).toBe(onlyPlaces);
  });

  it('turns places back on and clears categories when "All places" is not selected', () => {
    expect(run(INITIAL_MAP_FILTERS, ALL, ALL)).toEqual(INITIAL_MAP_FILTERS);
    const withCafe = run(INITIAL_MAP_FILTERS, cafe);
    expect(allPlacesSelected(withCafe)).toBe(false);
    expect(run(withCafe, ALL)).toEqual(INITIAL_MAP_FILTERS);
  });

  it('toggles categories (multi-select) and turns places on when one is chosen', () => {
    const two = run(INITIAL_MAP_FILTERS, cafe, bar);
    expect(two.categories).toEqual(['cafe', 'bar']);
    expect(categorySelected(two, 'cafe')).toBe(true);
    expect(run(two, cafe).categories).toEqual(['bar']);
    expect(allPlacesSelected(run(two, cafe, bar))).toBe(true); // last one removed = all places again

    const off = run(INITIAL_MAP_FILTERS, ALL);
    expect(categorySelected({ ...off, categories: ['cafe'] }, 'cafe')).toBe(false); // hidden while places are off
    expect(run(off, bar)).toMatchObject({ placesOn: true, categories: ['bar'] });
  });

  it('toggles events on its own', () => {
    expect(run(INITIAL_MAP_FILTERS, EVENTS)).toMatchObject({ eventsOn: false, placesOn: true, transitOn: false });
    expect(run(INITIAL_MAP_FILTERS, EVENTS, EVENTS)).toEqual(INITIAL_MAP_FILTERS);
  });

  it('brings places back if turning off the last other layer would leave nothing visible', () => {
    const placesOff = run(INITIAL_MAP_FILTERS, cafe, ALL, ALL); // cafe, back to all places, then places off
    expect(placesOff).toMatchObject({ placesOn: false, eventsOn: true });
    expect(run(placesOff, EVENTS)).toEqual({ placesOn: true, categories: [], eventsOn: false, transitOn: false });
  });
});

describe('mapFiltersReducer: Transport is exclusive', () => {
  it('turns every other layer off and remembers it, then clears the memory when turned off', () => {
    const on = run(INITIAL_MAP_FILTERS, TRANSPORT);
    expect(on).toEqual({
      placesOn: false,
      categories: [],
      eventsOn: false,
      transitOn: true,
      beforeTransport: { placesOn: true, categories: [], eventsOn: true },
    });
    const off = run(on, TRANSPORT);
    expect(off).toEqual(INITIAL_MAP_FILTERS);
    expect(off).not.toHaveProperty('beforeTransport');
  });

  it('restores categories and events exactly', () => {
    const start = run(INITIAL_MAP_FILTERS, cafe, bar);
    expect(start).toMatchObject({ placesOn: true, categories: ['cafe', 'bar'], eventsOn: true });
    expect(run(start, TRANSPORT, TRANSPORT)).toEqual(start);
  });

  it('restores an events-only state', () => {
    const eventsOnly = run(INITIAL_MAP_FILTERS, ALL);
    expect(eventsOnly).toMatchObject({ placesOn: false, eventsOn: true });
    expect(run(eventsOnly, TRANSPORT, TRANSPORT)).toEqual(eventsOnly);
  });

  it('restores a places-only state (events off)', () => {
    const placesOnly = run(INITIAL_MAP_FILTERS, cafe, EVENTS);
    expect(run(placesOnly, TRANSPORT, TRANSPORT)).toEqual(placesOnly);
  });

  it('falls back to all places if nothing would be visible after Transport', () => {
    const odd: MapFilters = { placesOn: false, categories: [], eventsOn: false, transitOn: true };
    const allPlacesOnly = { placesOn: true, categories: [], eventsOn: false, transitOn: false };
    expect(run(odd, TRANSPORT)).toEqual(allPlacesOnly);
    const emptyMemory: MapFilters = { ...odd, beforeTransport: { placesOn: false, categories: ['cafe'], eventsOn: false } };
    expect(run(emptyMemory, TRANSPORT)).toEqual(allPlacesOnly);
  });

  it('ignores the other chips while Transport is on', () => {
    const on = run(INITIAL_MAP_FILTERS, cafe, TRANSPORT);
    for (const a of [ALL, EVENTS, bar, cafe]) expect(mapFiltersReducer(on, a)).toBe(on);
    expect(run(on, ALL, EVENTS, bar, TRANSPORT)).toMatchObject({ placesOn: true, categories: ['cafe'], eventsOn: true, transitOn: false });
  });
});

describe('MapFilterBar', () => {
  it('puts "All places", "Events" and "Transport" first, then the categories', () => {
    render(<MapFilterBar filters={INITIAL_MAP_FILTERS} onChange={() => {}} />);
    const names = screen.getAllByRole('button').map((b) => b.props.accessibilityLabel);
    expect(names.slice(0, 3)).toEqual(['All places', 'Events', 'Transport']);
    expect(names).toContain('Cafés');
    expect(names).not.toContain('Transit');
  });

  it('reports each press as a filter action', () => {
    const onChange = jest.fn();
    render(<MapFilterBar filters={INITIAL_MAP_FILTERS} onChange={onChange} />);
    fireEvent.press(screen.getByText('All places'));
    fireEvent.press(screen.getByText('Events'));
    fireEvent.press(screen.getByText('Transport'));
    fireEvent.press(screen.getByText('Cafés'));
    expect(onChange.mock.calls.map((c) => c[0])).toEqual([ALL, EVENTS, TRANSPORT, cafe]);
  });

  it('greys out every chip but Transport while Transport is on', () => {
    const onChange = jest.fn();
    render(<MapFilterBar filters={run(INITIAL_MAP_FILTERS, TRANSPORT)} onChange={onChange} />);
    for (const id of ['chip-places', 'chip-events', 'chip-category-cafe']) {
      expect(screen.getByTestId(id).props.accessibilityState).toMatchObject({ disabled: true, selected: false });
      fireEvent.press(screen.getByTestId(id));
    }
    expect(screen.getByTestId('chip-transit').props.accessibilityState).toMatchObject({ disabled: false, selected: true });
    fireEvent.press(screen.getByTestId('chip-transit'));
    expect(onChange.mock.calls.map((c) => c[0])).toEqual([TRANSPORT]);
  });
});

/** The flattened style a chip currently renders with. */
function chipStyle(testID: string) {
  return StyleSheet.flatten(screen.getByTestId(testID).props.style);
}

describe('Chip colours', () => {
  it('keeps the selected yellow even over the map and with a caller background', () => {
    render(<Chip label="On" selected overMap style={{ backgroundColor: 'red', marginLeft: 4 }} testID="c" />);
    const s = chipStyle('c');
    expect(s.backgroundColor).toBe(colors.accent);
    expect(s.marginLeft).toBe(4);
  });

  it('uses the translucent map fill when idle over the map, and the surface elsewhere', () => {
    render(
      <>
        <Chip label="Map" overMap testID="map" />
        <Chip label="Plain" testID="plain" />
      </>,
    );
    expect(chipStyle('map').backgroundColor).toBe(MAP_CHIP_BG);
    expect(chipStyle('plain').backgroundColor).toBe(colors.surface);
    expect(chipColors(false, true).fg).toBe(colors.text);
    expect(chipColors(true, false).fg).toBe(colors.onAccent);
  });

  it('dims while pressed without losing its colour', () => {
    const style = chipPressableStyle(true, true, { backgroundColor: 'red' });
    expect(StyleSheet.flatten(style({ pressed: false })).opacity).toBeUndefined();
    const pressed = StyleSheet.flatten(style({ pressed: true }));
    expect(pressed.backgroundColor).toBe(colors.accent);
    expect(pressed.opacity).toBeLessThan(1);
  });
});

const markers = (kind: 'place' | 'event') => screen.queryAllByTestId(new RegExp(`^${kind}-marker-`));

/** Zooms the mocked map in so places load and pins are not grouped. */
async function zoomIn() {
  await act(async () => {
    fireEvent(screen.getByTestId('main-map'), 'regionChangeComplete', { latitude: 45.7537, longitude: 21.2257, latitudeDelta: 0.01, longitudeDelta: 0.01 });
    await new Promise((r) => setTimeout(r, 400));
  });
}

describe('MapScreen filters', () => {
  it('hides place pins with "All places" while events stay, and shows them again', async () => {
    renderScreen(<MapScreen />);
    await zoomIn();
    await waitFor(() => expect(markers('place').length).toBeGreaterThan(10));
    fireEvent.press(screen.getByTestId('chip-places'));
    await waitFor(() => expect(markers('place')).toHaveLength(0));
    expect(markers('event').length).toBeGreaterThan(0);
    fireEvent.press(screen.getByTestId('chip-places'));
    await waitFor(() => expect(markers('place').length).toBeGreaterThan(10));
  });

  it('keeps places when they are the only layer on', async () => {
    renderScreen(<MapScreen />);
    await zoomIn();
    fireEvent.press(screen.getByTestId('chip-events'));
    fireEvent.press(screen.getByTestId('chip-places'));
    await waitFor(() => expect(markers('place').length).toBeGreaterThan(10));
    expect(screen.getByTestId('chip-places').props.accessibilityState).toMatchObject({ selected: true });
  });

  it('hides the "Zoom in to see places" hint while places are off', async () => {
    renderScreen(<MapScreen />);
    await act(async () => {
      fireEvent(screen.getByTestId('main-map'), 'regionChangeComplete', { latitude: 45.75, longitude: 21.22, latitudeDelta: 0.5, longitudeDelta: 0.5 });
      await new Promise((r) => setTimeout(r, 400));
    });
    expect(screen.getByTestId('zoom-hint')).toBeTruthy();
    fireEvent.press(screen.getByTestId('chip-places'));
    expect(screen.queryByTestId('zoom-hint')).toBeNull();
  });

  it('Transport hides places and events and greys the chips; turning it off brings the same filters back', async () => {
    renderScreen(<MapScreen />);
    await zoomIn();
    fireEvent.press(screen.getByTestId('chip-category-cafe'));
    fireEvent.press(screen.getByTestId('chip-events')); // events off
    fireEvent.press(screen.getByTestId('chip-events')); // and on again
    await waitFor(() => expect(markers('place').length).toBeGreaterThan(0));
    await waitFor(() => expect(markers('event').length).toBeGreaterThan(0));
    const before = markers('place').length;

    fireEvent.press(screen.getByTestId('chip-transit'));
    await waitFor(() => expect(markers('place')).toHaveLength(0));
    expect(markers('event')).toHaveLength(0);
    for (const id of ['chip-places', 'chip-events', 'chip-category-cafe']) {
      expect(screen.getByTestId(id).props.accessibilityState).toMatchObject({ disabled: true, selected: false });
    }
    fireEvent.press(screen.getByTestId('chip-category-bar')); // ignored
    expect(screen.getByTestId('chip-category-bar').props.accessibilityState).toMatchObject({ selected: false });

    fireEvent.press(screen.getByTestId('chip-transit'));
    await waitFor(() => expect(markers('place')).toHaveLength(before));
    await waitFor(() => expect(markers('event').length).toBeGreaterThan(0));
    expect(screen.getByTestId('chip-category-cafe').props.accessibilityState).toMatchObject({ selected: true, disabled: false });
    expect(screen.getByTestId('chip-events').props.accessibilityState).toMatchObject({ selected: true, disabled: false });
    expect(screen.getByTestId('chip-places').props.accessibilityState).toMatchObject({ selected: false });
    expect(screen.getByTestId('chip-category-bar').props.accessibilityState).toMatchObject({ selected: false });
  });

  it('closes an open place panel when Transport is turned on (its pin is hidden)', async () => {
    renderScreen(<MapScreen />);
    await zoomIn();
    await waitFor(() => expect(markers('place').length).toBeGreaterThan(0));
    fireEvent.press(markers('place')[0]);
    expect(await screen.findByTestId('place-panel')).toBeTruthy();
    fireEvent.press(screen.getByTestId('chip-transit'));
    await waitFor(() => expect(screen.queryByTestId('place-panel')).toBeNull());
    expect(markers('place')).toHaveLength(0);
  });

  it('turns Transport off when a place is shown on the map from elsewhere, so its pin and panel appear', async () => {
    renderScreen(<MapScreen />);
    fireEvent.press(screen.getByTestId('chip-transit'));
    expect(screen.getByTestId('chip-transit').props.accessibilityState).toMatchObject({ selected: true });
    setParams({ lat: '45.7537', lon: '21.2257', placeId: placeId(0), at: '2' });
    await zoomIn(); // any re-render picks the new params up
    expect(await screen.findByTestId('place-panel')).toBeTruthy();
    expect(screen.getByTestId('chip-transit').props.accessibilityState).toMatchObject({ selected: false });
    await waitFor(() => expect(markers('place').length).toBeGreaterThan(0));
  });

  it('never shows line chips: Transport shows the whole network at once', async () => {
    renderScreen(<MapScreen />);
    fireEvent.press(screen.getByTestId('chip-transit'));
    await waitFor(() => expect(screen.getAllByTestId(/^vehicle-marker-/).length).toBeGreaterThan(0));
    expect(screen.queryByTestId('transit-lines')).toBeNull();
    expect(screen.queryByTestId(/^chip-line-/)).toBeNull();
  });
});
