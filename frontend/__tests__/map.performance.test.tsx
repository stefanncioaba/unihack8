// Map smoothness (lag fixes): vehicles off screen are not drawn, markers and line paths are not re-rendered when
// nothing they show changed, custom markers share one tracking timer, and the map context hands out a stable bbox.
import { QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Profiler, useEffect } from 'react';
import { Text } from 'react-native';

import type { TransitShape, TransitVehicle } from '@/api/types.transit';
import { DirectionsLayer } from '@/features/directions/DirectionsLayer';
import { MARKER_TRACK_MS, pendingTrackingCount, scheduleTrackingOff, trackingTimerArmed, trackingTimerArms, useBriefViewTracking } from '@/features/map/ClusterMarker';
import { MapProvider, useMapContext, type MapContextValue } from '@/features/map/MapContext';
import * as lines from '@/features/transit/lines';
import { lineDirections } from '@/features/transit/lineView';
import { TransitLayer } from '@/features/transit/TransitLayer';
import { sameVehicleMarker, VehicleMarker } from '@/features/transit/VehicleMarker';
import type { Bbox } from '@/lib/bbox';
import { createQueryClient } from '@/lib/queryClient';
import * as polyline from '@/lib/polyline';

import { renderScreen } from './testUtils';

/** A vehicle with sensible defaults. */
function vehicle(over: Partial<TransitVehicle> = {}): TransitVehicle {
  return {
    id: 'v1',
    route: '1',
    routeName: '1',
    type: 'TRAM',
    color: null,
    lat: 45.75,
    lon: 21.22,
    bearing: null,
    speedKmh: 20,
    headsign: 'Gara de Nord',
    nextStop: 'Piața Maria',
    accessible: true,
    reportedAt: '2026-11-14T10:00:00Z',
    ...over,
  };
}

const vehicleMarkers = () => screen.queryAllByTestId(/^vehicle-marker-/);
const view: Bbox = { minLat: 45.74, maxLat: 45.76, minLon: 21.21, maxLon: 21.23 };

afterEach(() => jest.restoreAllMocks());

describe('vehiclesInView', () => {
  const inside = vehicle({ id: 'in' });
  const nearEdge = vehicle({ id: 'near', lat: 45.775 }); // in the margin (one view height above)
  const far = vehicle({ id: 'far', lat: 45.9, lon: 21.5 });

  it('keeps the vehicles in the view and its margin, and drops the ones far away', () => {
    expect(lines.vehiclesInView([inside, nearEdge, far], view).map((v) => v.id)).toEqual(['in', 'near']);
    expect(lines.vehiclesInView([inside, nearEdge, far], view, 0).map((v) => v.id)).toEqual(['in']);
  });

  it('keeps every vehicle when the view is unknown', () => {
    const all = [inside, far];
    expect(lines.vehiclesInView(all, null)).toBe(all);
    expect(lines.vehiclesInView(all, undefined)).toBe(all);
  });
});

describe('sameVehicleMarker', () => {
  const onPress = jest.fn();
  const base = { vehicle: vehicle(), selected: false, onPress };

  it('ignores what the marker does not show (report time, speed, next stop)', () => {
    expect(sameVehicleMarker(base, { ...base, vehicle: vehicle({ reportedAt: '2026-11-14T10:00:10Z', speedKmh: 0, nextStop: 'Bastion' }) })).toBe(true);
  });

  it('re-renders for a move, a new look, a selection or a new handler', () => {
    expect(sameVehicleMarker(base, { ...base, vehicle: vehicle({ lat: 45.751 }) })).toBe(false);
    expect(sameVehicleMarker(base, { ...base, vehicle: vehicle({ routeName: '1b' }) })).toBe(false);
    expect(sameVehicleMarker(base, { ...base, selected: true })).toBe(false);
    expect(sameVehicleMarker(base, { ...base, onPress: jest.fn() })).toBe(false);
    expect(sameVehicleMarker(base, { ...base, vehicle: vehicle({ id: 'v2' }) })).toBe(false);
  });
});

describe('TransitLayer re-renders', () => {
  const shapes: TransitShape[] = [
    { route: '1', routeName: '1', type: 'TRAM', color: null, polylines: [polyline.encodePolyline([{ lat: 45.75, lon: 21.2 }, { lat: 45.76, lon: 21.21 }])] },
  ];
  const directions = lineDirections(shapes, '1', polyline.decodePolyline);
  const fleet = (reportedAt: string, lat = 45.75) => [vehicle({ id: 'a', reportedAt, lat }), vehicle({ id: 'b', route: '14', routeName: '14', reportedAt })];

  /** The layer with fixed handlers, so only the data changes between renders. */
  const handlers = { onSelectStop: jest.fn(), onSelectVehicle: jest.fn() };
  const layer = (vehicles: TransitVehicle[], bbox?: Bbox | null) => (
    <TransitLayer stops={undefined} lineId={null} vehicles={vehicles} bbox={bbox} {...handlers} />
  );

  it('does not redraw the chosen line route when the vehicles refresh', () => {
    const lineLayer = (vehicles: TransitVehicle[]) => (
      <TransitLayer stops={undefined} lineId="1" directions={directions} directionIndex={0} vehicles={vehicles} {...handlers} />
    );
    const alpha = jest.spyOn(lines, 'withAlpha');
    const { rerender } = render(lineLayer(fleet('2026-11-14T10:00:00Z')));
    const drawn = alpha.mock.calls.length;
    expect(drawn).toBeGreaterThan(0); // the halo
    expect(screen.getByTestId('line-route-1')).toBeTruthy();

    rerender(lineLayer(fleet('2026-11-14T10:00:10Z', 45.751)));
    expect(alpha.mock.calls.length).toBe(drawn); // the route was not re-rendered
  });

  it('a refresh that only changed report time or position moves the marker, nothing else', () => {
    const { rerender } = render(layer(fleet('2026-11-14T10:00:00Z')));
    const image = screen.getByTestId('vehicle-marker-a').props.image;
    rerender(layer(fleet('2026-11-14T10:00:10Z'))); // new objects, same look and place
    expect(screen.getByTestId('vehicle-marker-a').props.image).toBe(image);
    rerender(layer(fleet('2026-11-14T10:00:20Z', 45.752))); // "a" moved
    expect(screen.getByTestId('vehicle-marker-a').props.image).toBe(image);
    expect(screen.getByTestId('vehicle-marker-a').props.coordinate).toEqual({ latitude: 45.752, longitude: 21.22 });
  });

  it('hands the latest report of a tapped vehicle over, even when its marker was not re-rendered', () => {
    const { rerender } = render(layer(fleet('2026-11-14T10:00:00Z')));
    rerender(layer(fleet('2026-11-14T10:00:10Z')));
    fireEvent.press(screen.getByTestId('vehicle-marker-a'));
    expect(handlers.onSelectVehicle).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'a', reportedAt: '2026-11-14T10:00:10Z' }));
  });

  it('draws only the vehicles near the visible area', () => {
    const vehicles = [vehicle({ id: 'in' }), vehicle({ id: 'far', lat: 46.2, lon: 21.9 })];
    const { rerender } = render(layer(vehicles, view));
    expect(vehicleMarkers().map((m) => m.props.testID)).toEqual(['vehicle-marker-in']);
    rerender(layer(vehicles, null));
    expect(vehicleMarkers()).toHaveLength(2);
  });

  it('draws the vehicles of the new area after a pan', () => {
    // "east" is far outside `view` plus its margin, but inside the view after panning east.
    const vehicles = [vehicle({ id: 'in' }), vehicle({ id: 'east', lon: 21.4 })];
    const panned: Bbox = { minLat: 45.74, maxLat: 45.76, minLon: 21.39, maxLon: 21.41 };
    const { rerender } = render(layer(vehicles, view));
    expect(screen.queryByTestId('vehicle-marker-east')).toBeNull();
    rerender(layer(vehicles, panned));
    expect(screen.getByTestId('vehicle-marker-east')).toBeTruthy();
    expect(screen.queryByTestId('vehicle-marker-in')).toBeNull();
  });

  it('moves only the marker of the vehicle that moved', () => {
    const { rerender } = render(layer(fleet('2026-11-14T10:00:00Z')));
    const a = screen.getByTestId('vehicle-marker-a').props.coordinate;
    const b = screen.getByTestId('vehicle-marker-b').props.coordinate;
    rerender(layer([vehicle({ id: 'a', reportedAt: '2026-11-14T10:00:10Z', lat: 45.7505, lon: 21.2205 }), vehicle({ id: 'b', route: '14', routeName: '14', reportedAt: '2026-11-14T10:00:10Z' })]));
    const a2 = screen.getByTestId('vehicle-marker-a').props.coordinate;
    expect(a2).not.toBe(a);
    expect(a2).toEqual({ latitude: 45.7505, longitude: 21.2205 });
    expect(screen.getByTestId('vehicle-marker-b').props.coordinate).toBe(b); // untouched
  });
});

describe('VehicleMarker coordinate', () => {
  it('keeps the same coordinate object while the vehicle does not move', () => {
    const onPress = jest.fn();
    const { rerender } = render(<VehicleMarker vehicle={vehicle()} selected={false} onPress={onPress} />);
    const first = screen.getByTestId('vehicle-marker-v1').props.coordinate;
    rerender(<VehicleMarker vehicle={vehicle()} selected onPress={onPress} />); // re-renders (selected) but did not move
    expect(screen.getByTestId('vehicle-marker-v1').props.coordinate).toBe(first);
  });
});

describe('shared marker tracking timer', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  /** Prints the hook's value. */
  function Probe({ id }: { id: number }) {
    return <Text testID={`probe-${id}`}>{String(useBriefViewTracking('look'))}</Text>;
  }

  it('switches every marker that appeared together off in one commit', () => {
    const commits = jest.fn();
    render(
      <Profiler id="markers" onRender={commits}>
        {Array.from({ length: 50 }, (_, i) => (
          <Probe key={i} id={i} />
        ))}
      </Profiler>,
    );
    expect(pendingTrackingCount()).toBe(50);
    commits.mockClear();
    act(() => jest.advanceTimersByTime(MARKER_TRACK_MS));
    expect(screen.getByTestId('probe-0').props.children).toBe('false');
    expect(screen.getByTestId('probe-49').props.children).toBe('false');
    expect(commits).toHaveBeenCalledTimes(1); // not 50 separate re-renders
    expect(pendingTrackingCount()).toBe(0);
  });

  it('forgets markers that unmount before their time, and runs later ones on their own time', () => {
    const early = jest.fn();
    const late = jest.fn();
    const cancel = scheduleTrackingOff(early, 100);
    scheduleTrackingOff(late, 500);
    cancel();
    act(() => jest.advanceTimersByTime(499));
    expect(late).not.toHaveBeenCalled();
    act(() => jest.advanceTimersByTime(1));
    expect(late).toHaveBeenCalledTimes(1);
    expect(early).not.toHaveBeenCalled();
    expect(pendingTrackingCount()).toBe(0);
  });

  it('only re-arms the timer for an earlier marker, and disarms when the last one is cancelled', () => {
    const first = jest.fn();
    const cancels = [scheduleTrackingOff(first, 100)];
    const armed = trackingTimerArms();
    // 200 markers due later: no new timer for any of them.
    for (let i = 0; i < 200; i++) cancels.push(scheduleTrackingOff(jest.fn(), 300));
    expect(trackingTimerArms()).toBe(armed);
    // One due earlier re-arms once.
    cancels.push(scheduleTrackingOff(jest.fn(), 50));
    expect(trackingTimerArms()).toBe(armed + 1);
    cancels.forEach((c) => c());
    expect(pendingTrackingCount()).toBe(0);
    expect(trackingTimerArmed()).toBe(false);
    act(() => jest.advanceTimersByTime(1000));
    expect(first).not.toHaveBeenCalled();
  });

  it('a cancelled earliest marker does not delay the later ones', () => {
    const late = jest.fn();
    const cancel = scheduleTrackingOff(jest.fn(), 100);
    scheduleTrackingOff(late, 300);
    cancel();
    act(() => jest.advanceTimersByTime(300));
    expect(late).toHaveBeenCalledTimes(1);
    expect(trackingTimerArmed()).toBe(false);
  });
});

describe('MapContext bbox', () => {
  /** Hands the context value out to the test. */
  function Spy({ onValue }: { onValue: (v: MapContextValue) => void }) {
    const ctx = useMapContext();
    useEffect(() => {
      onValue(ctx);
    });
    return null;
  }

  it('stays the same object across selections and pans that round to the same box', () => {
    jest.useFakeTimers();
    try {
      let ctx!: MapContextValue;
      render(
        <QueryClientProvider client={createQueryClient()}>
          <MapProvider userPosition={{ lat: 45.75, lon: 21.22 }} initialBbox={{ minLat: 45.74, minLon: 21.21, maxLat: 45.76, maxLon: 21.23 }}>
            <Spy onValue={(v) => (ctx = v)} />
          </MapProvider>
        </QueryClientProvider>,
      );
      const first = ctx.bbox;
      act(() => ctx.select({ type: 'place', id: 'p1' }));
      expect(ctx.bbox).toBe(first);
      act(() => ctx.setVisibleBbox({ minLat: 45.74001, minLon: 21.21001, maxLat: 45.75999, maxLon: 21.22999 }));
      act(() => jest.advanceTimersByTime(400));
      expect(ctx.bbox).toBe(first);
      act(() => ctx.setVisibleBbox({ minLat: 45.75, minLon: 21.22, maxLat: 45.77, maxLon: 21.24 }));
      act(() => jest.advanceTimersByTime(400));
      expect(ctx.bbox).toEqual({ minLat: 45.75, minLon: 21.22, maxLat: 45.77, maxLon: 21.24 });
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('DirectionsLayer re-renders', () => {
  /** Hands the context value out to the test. */
  function Spy({ onValue }: { onValue: (v: MapContextValue) => void }) {
    const ctx = useMapContext();
    useEffect(() => {
      onValue(ctx);
    });
    return null;
  }

  it('keeps the route lines and leg vehicles as they are when the map pans or a selection changes', async () => {
    let ctx!: MapContextValue;
    renderScreen(
      <MapProvider userPosition={{ lat: 45.76, lon: 21.23 }} initialBbox={{ minLat: 45.74, minLon: 21.21, maxLat: 45.76, maxLon: 21.23 }}>
        <Spy onValue={(v) => (ctx = v)} />
        <DirectionsLayer />
      </MapProvider>,
    );
    act(() => ctx.setDestination({ coords: { lat: 45.7275, lon: 21.2355 }, title: 'Shopping City' }));
    await waitFor(() => expect(screen.getByTestId('route-line-1')).toBeTruthy());
    await waitFor(() => expect(screen.queryAllByTestId(/^leg-vehicle-marker-/).length).toBeGreaterThan(0));
    // Let every query (routes, vehicles) settle before measuring.
    await act(async () => new Promise((r) => setTimeout(r, 50)));
    const lineCoords = screen.getAllByTestId(/^route-line-/).map((l) => l.props.coordinates);
    const vehicleCoords = screen.getAllByTestId(/^leg-vehicle-marker-/).map((m) => m.props.coordinate);
    const decode = jest.spyOn(polyline, 'decodePolyline');
    const color = jest.spyOn(lines, 'lineColor');

    // A new selection object for the same destination (as a panel change makes), then a pan.
    act(() => ctx.setDestination(ctx.destination));
    act(() => ctx.setVisibleBbox({ minLat: 45.75, minLon: 21.22, maxLat: 45.77, maxLon: 21.24 }));
    await waitFor(() => expect(ctx.bbox).toEqual({ minLat: 45.75, minLon: 21.22, maxLat: 45.77, maxLon: 21.24 }));

    expect(decode).not.toHaveBeenCalled(); // no leg decoded again
    expect(color).not.toHaveBeenCalled(); // no line, guidance marker or vehicle badge re-rendered
    screen.getAllByTestId(/^route-line-/).forEach((l, i) => expect(l.props.coordinates).toBe(lineCoords[i]));
    screen.getAllByTestId(/^leg-vehicle-marker-/).forEach((m, i) => expect(m.props.coordinate).toBe(vehicleCoords[i]));
  });
});
