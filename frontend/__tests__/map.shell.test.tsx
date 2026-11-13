// Map shell (14.1): bbox helpers, MapContext (debounce, selection, destination) and the bottom panel.
import { QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';

import { MapPanel } from '@/features/map/MapPanel';
import { MapProvider, useMapContext, type MapContextValue } from '@/features/map/MapContext';
import { bboxContains, bboxParam, regionToBbox, roundBbox } from '@/lib/bbox';
import { createQueryClient } from '@/lib/queryClient';

import { renderScreen } from './testUtils';

const START = { minLon: 21.0, minLat: 45.0, maxLon: 21.1, maxLat: 45.1 };

describe('bbox helpers', () => {
  it('turns a map region into the area it shows', () => {
    const b = regionToBbox({ latitude: 45.75, longitude: 21.2, latitudeDelta: 0.04, longitudeDelta: 0.1 });
    expect(b.minLat).toBeCloseTo(45.73);
    expect(b.maxLat).toBeCloseTo(45.77);
    expect(b.minLon).toBeCloseTo(21.15);
    expect(b.maxLon).toBeCloseTo(21.25);
  });

  it('rounds to ~100 m, formats the query value and tests containment', () => {
    const b = roundBbox({ minLon: 21.18049, minLat: 45.73051, maxLon: 21.26049, maxLat: 45.77049 });
    expect(b).toEqual({ minLon: 21.18, minLat: 45.731, maxLon: 21.26, maxLat: 45.77 });
    expect(bboxParam(b)).toBe('21.18,45.731,21.26,45.77');
    expect(bboxContains(b, { lat: 45.75, lon: 21.2 })).toBe(true);
    expect(bboxContains(b, { lat: 46, lon: 21.2 })).toBe(false);
  });
});

/** Renders the provider and exposes its value. */
function setup() {
  const box: { current: MapContextValue | null } = { current: null };
  /** Copies the context into `box`. */
  function Probe() {
    box.current = useMapContext();
    return <Text>{box.current.selection ? box.current.selection.type : 'none'}</Text>;
  }
  const client = createQueryClient();
  client.setDefaultOptions({ queries: { retry: false, gcTime: Infinity } });
  render(
    <QueryClientProvider client={client}>
      <MapProvider userPosition={{ lat: 45.7537, lon: 21.2257 }} initialBbox={START}>
        <Probe />
        <MapPanel />
      </MapProvider>
    </QueryClientProvider>,
  );
  return box;
}

describe('MapContext', () => {
  it('starts with the initial area and no selection', () => {
    const box = setup();
    expect(box.current!.bbox).toEqual(START);
    expect(box.current!.selection).toBeNull();
    expect(box.current!.destination).toBeNull();
    expect(box.current!.userPosition).toEqual({ lat: 45.7537, lon: 21.2257 });
  });

  it('debounces the visible area and rounds it', async () => {
    const box = setup();
    act(() => box.current!.setVisibleBbox({ minLon: 21.1111, minLat: 45.1111, maxLon: 21.2222, maxLat: 45.2222 }));
    act(() => box.current!.setVisibleBbox({ minLon: 21.3333, minLat: 45.3333, maxLon: 21.4444, maxLat: 45.4444 }));
    expect(box.current!.bbox).toEqual(START); // nothing yet
    await waitFor(() => expect(box.current!.bbox).toEqual({ minLon: 21.333, minLat: 45.333, maxLon: 21.444, maxLat: 45.444 }));
  });

  it('keeps one selection at a time; a destination is a selection', () => {
    const box = setup();
    act(() => box.current!.select({ type: 'place', id: 'p1' }));
    expect(screen.getByText('place')).toBeTruthy();
    act(() => box.current!.select({ type: 'event', id: 'e1' }));
    expect(screen.getByText('event')).toBeTruthy();

    act(() => box.current!.setDestination({ coords: { lat: 45.7, lon: 21.2 }, title: 'Home' }));
    expect(box.current!.selection?.type).toBe('destination');
    expect(box.current!.destination).toEqual({ coords: { lat: 45.7, lon: 21.2 }, title: 'Home' });

    act(() => box.current!.setDestination(null));
    expect(box.current!.selection).toBeNull();
    expect(box.current!.destination).toBeNull();
  });

  it('throws outside the provider', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => renderScreen(<MapPanel />)).toThrow('useMapContext must be used inside <MapProvider>');
    spy.mockRestore();
  });
});

describe('MapPanel', () => {
  it('renders nothing without a selection and closes with the X', () => {
    const box = setup();
    expect(screen.queryByTestId('map-panel')).toBeNull();
    act(() => box.current!.select({ type: 'stop', id: '1' }));
    expect(screen.getByTestId('map-panel')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Close panel' }));
    expect(screen.queryByTestId('map-panel')).toBeNull();
    expect(box.current!.selection).toBeNull();
  });
});
