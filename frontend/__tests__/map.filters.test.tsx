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

import { renderScreen } from './testUtils';

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
    expect(run(INITIAL_MAP_FILTERS, EVENTS, TRANSPORT, ALL).placesOn).toBe(false); // transport alone is enough
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

  it('toggles events and transport independently', () => {
    expect(run(INITIAL_MAP_FILTERS, TRANSPORT)).toMatchObject({ eventsOn: true, transitOn: true, placesOn: true });
    expect(run(INITIAL_MAP_FILTERS, TRANSPORT, EVENTS)).toMatchObject({ eventsOn: false, transitOn: true });
    expect(run(INITIAL_MAP_FILTERS, TRANSPORT, TRANSPORT).transitOn).toBe(false);
  });

  it('brings places back if turning off the last other layer would leave nothing visible', () => {
    const placesOff = run(INITIAL_MAP_FILTERS, cafe, ALL, ALL); // cafe, back to all places, then places off
    expect(placesOff).toMatchObject({ placesOn: false, eventsOn: true });
    expect(run(placesOff, EVENTS)).toEqual({ placesOn: true, categories: [], eventsOn: false, transitOn: false });
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

  it('shows the line chips only while Transport is on', async () => {
    renderScreen(<MapScreen />);
    expect(screen.queryByTestId('transit-lines')).toBeNull();
    fireEvent.press(screen.getByTestId('chip-transit'));
    expect(await screen.findByTestId('chip-line-1')).toBeTruthy();
    fireEvent.press(screen.getByTestId('chip-transit'));
    await waitFor(() => expect(screen.queryByTestId('transit-lines')).toBeNull());
  });
});
