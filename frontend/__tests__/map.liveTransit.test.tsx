// Live transit on the map: every line's path and every live vehicle, the vehicle panel, and the live vehicles of a
// route's ride legs in directions and journey mode. Helpers (colours, leg -> line mapping, ages) are tested directly.
import { QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { useEffect } from 'react';

import type { RouteLeg } from '@/api/types.routing';
import type { TransitRoute, TransitShape, TransitVehicle } from '@/api/types.transit';
import MapScreen from '@/app/(tabs)/map';
import { MapProvider, destinationOf, useMapContext } from '@/features/map/MapContext';
import { MapPanel } from '@/features/map/MapPanel';
import {
  LINE_PALETTE,
  decodeShapes,
  isReportOld,
  lineColor,
  nearestVehicle,
  relativeAge,
  resolveLineId,
  rideLegLines,
  sameLine,
  typeLabel,
  vehicleIcon,
  vehicleLineName,
  vehiclesOfLine,
  withAlpha,
} from '@/features/transit/lines';
import { SHAPE_WIDTH, TransitLayer } from '@/features/transit/TransitLayer';
import { speedLabel } from '@/features/transit/VehiclePanel';
import { createQueryClient } from '@/lib/queryClient';
import { decodePolyline, encodePolyline } from '@/lib/polyline';
import * as mocks from '@test/mocks';
import { LINE_STOPS, MOCK_ROUTES } from '@test/mocks/transitSeed';

import { renderScreen } from './testUtils';

const call = (path: string, query: Record<string, unknown> = {}) => mocks.mockRequest('GET', path, query) as Promise<any>;

/** A vehicle with sensible defaults. */
function vehicle(over: Partial<TransitVehicle> = {}): TransitVehicle {
  return {
    id: 'v1',
    route: '1',
    routeName: '1',
    type: 'TRAM',
    color: '#e3a900',
    lat: 45.75,
    lon: 21.22,
    bearing: null,
    speedKmh: 20,
    headsign: 'Gara de Nord',
    nextStop: 'Piața Maria',
    accessible: true,
    reportedAt: new Date().toISOString(),
    ...over,
  };
}

/** A ride or walk leg. */
function leg(mode: RouteLeg['mode'], route: string | null, extra: Partial<RouteLeg> = {}): RouteLeg {
  return { mode, route, headsign: null, from: null, to: null, startsAt: null, endsAt: null, durationMinutes: 5, polyline: null, ...extra };
}

/** Moves the mocked map to a region and waits for the debounce + reload. */
async function moveTo(latitudeDelta: number) {
  await act(async () => {
    fireEvent(screen.getByTestId('main-map'), 'regionChangeComplete', { latitude: 45.752, longitude: 21.225, latitudeDelta, longitudeDelta: latitudeDelta });
    await new Promise((r) => setTimeout(r, 400));
  });
}

const vehicleMarkers = () => screen.queryAllByTestId(/^vehicle-marker-/);
const legVehicleMarkers = () => screen.queryAllByTestId(/^leg-vehicle-marker-/);
const shapeLines = () => screen.queryAllByTestId(/^shape-line-/);

afterEach(() => jest.restoreAllMocks());

describe('line helpers', () => {
  it('gives every line a stable palette colour of its own (STPT colours every tram the same)', () => {
    const e4 = lineColor('E4');
    expect(LINE_PALETTE).toContain(e4);
    expect(lineColor('e4 ')).toBe(e4); // same line in another case: same colour
    expect(LINE_PALETTE).toContain(lineColor(null));
    const colours = new Set(['E1', 'E2', 'E3', 'E4', 'E6', 'E7', 'E8', 'M14', 'M30', '33'].map((r) => lineColor(r)));
    expect(colours.size).toBeGreaterThan(5);
    expect(lineColor('1')).not.toBe(lineColor('2'));
  });

  it('turns hex colours into rgba with an opacity', () => {
    expect(withAlpha('#ff0000', 0.5)).toBe('rgba(255,0,0,0.5)');
    expect(withAlpha('#0f0', 1)).toBe('rgba(0,255,0,1)');
    expect(withAlpha('red', 0.5)).toBe('red');
  });

  it('names and draws each vehicle type', () => {
    expect(vehicleIcon('TRAM')).toBe('train');
    expect(vehicleIcon('TROLLEYBUS')).toBe('flash');
    expect(vehicleIcon('BUS')).toBe('bus');
    expect(vehicleIcon(null)).toBe('bus');
    expect(typeLabel('TROLLEYBUS')).toBe('Trolleybus');
    expect(typeLabel('EXPRESS')).toBe('Express bus');
    expect(typeLabel(null)).toBe('Line');
    expect(vehicleLineName({ route: '5b', routeName: null })).toBe('5b');
    expect(vehicleLineName({ route: 'm14', routeName: 'M14' })).toBe('M14');
  });

  it('maps a leg line (id or display name, any case) to the /transit/routes id', () => {
    const routes: TransitRoute[] = [
      { id: '1', type: 'TRAM', name: '1', from: null, to: null, color: null },
      { id: 'e2', type: 'EXPRESS', name: 'E2', from: null, to: null, color: null },
      { id: '5b', type: 'BUS', name: '5b', from: null, to: null, color: null },
    ];
    expect(resolveLineId('1', routes)).toBe('1');
    expect(resolveLineId('E2', routes)).toBe('e2');
    expect(resolveLineId('5B', routes)).toBe('5b');
    expect(resolveLineId('99', routes)).toBe('99');
    expect(resolveLineId(' E2 ', undefined)).toBe('E2');
    expect(resolveLineId(null, routes)).toBeNull();
    expect(resolveLineId('  ', routes)).toBeNull();
    expect(rideLegLines([leg('WALK', null), leg('TRAM', '1'), leg('BUS', 'E2'), leg('BUS', 'e2'), leg('WALK', null)], routes)).toEqual(['1', 'e2']);
    expect(rideLegLines(undefined, routes)).toEqual([]);
    expect(sameLine('M14', 'm14')).toBe(true);
    expect(sameLine(null, null)).toBe(false);
  });

  it('filters vehicles by line', () => {
    const list = [vehicle({ id: 'a', route: '1' }), vehicle({ id: 'b', route: 'E4' })];
    expect(vehiclesOfLine(list, null)).toHaveLength(2);
    expect(vehiclesOfLine(list, 'e4').map((v) => v.id)).toEqual(['b']);
    expect(vehiclesOfLine(undefined, '1')).toEqual([]);
  });

  it('writes report ages and spots old reports', () => {
    const now = Date.parse('2026-11-14T12:00:00Z');
    expect(relativeAge('2026-11-14T11:59:58Z', now)).toBe('just now');
    expect(relativeAge('2026-11-14T11:59:35Z', now)).toBe('25 s ago');
    expect(relativeAge('2026-11-14T11:57:00Z', now)).toBe('3 min ago');
    expect(relativeAge('2026-11-14T10:00:00Z', now)).toBe('2 h ago');
    expect(isReportOld('2026-11-14T11:59:00Z', now)).toBe(false);
    expect(isReportOld('2026-11-14T11:57:00Z', now)).toBe(true);
  });

  it('finds the nearest vehicle, preferring the ones heading the leg way', () => {
    const stop = { lat: 45.75, lon: 21.22 };
    const near = vehicle({ id: 'near', lat: 45.7501, headsign: 'Shopping City' });
    const far = vehicle({ id: 'far', lat: 45.76, headsign: 'Gara de Nord' });
    expect(nearestVehicle([far, near], stop)?.vehicle.id).toBe('near');
    expect(nearestVehicle([far, near], stop, 'gara de nord')?.vehicle.id).toBe('far');
    expect(nearestVehicle([far, near], stop, 'Nowhere')?.vehicle.id).toBe('near');
    expect(nearestVehicle([], stop)).toBeNull();
    expect(nearestVehicle([near], stop)!.meters).toBeLessThan(20);
  });

  it('decodes shapes into coloured paths and drops broken ones', () => {
    const shapes: TransitShape[] = [
      { route: '1', routeName: '1', type: 'TRAM', color: '#e3a900', polylines: [encodePolyline([{ lat: 45.75, lon: 21.2 }, { lat: 45.76, lon: 21.21 }]), encodePolyline([{ lat: 45.75, lon: 21.2 }])] },
      { route: 'E4', routeName: 'E4', type: 'EXPRESS', color: null, polylines: [] },
    ];
    const drawn = decodeShapes(shapes, decodePolyline);
    expect(drawn[0]).toEqual({ route: '1', color: lineColor('1'), paths: [[{ latitude: 45.75, longitude: 21.2 }, { latitude: 45.76, longitude: 21.21 }]] });
    expect(drawn[1]).toMatchObject({ route: 'E4', color: lineColor('E4'), paths: [] });
    expect(decodeShapes(undefined, decodePolyline)).toEqual([]);
  });

  it('draws two lines with the same STPT colour in different colours', () => {
    const path = encodePolyline([{ lat: 45.75, lon: 21.2 }, { lat: 45.76, lon: 21.21 }]);
    const drawn = decodeShapes(
      [
        { route: '1', routeName: '1', type: 'TRAM', color: '#e3a900', polylines: [path] },
        { route: '2', routeName: '2', type: 'TRAM', color: '#e3a900', polylines: [path] },
      ],
      decodePolyline,
    );
    expect(drawn[0].color).not.toBe(drawn[1].color);
  });

  it('merges shape entries of the same line into one drawn line', () => {
    const a = encodePolyline([{ lat: 45.75, lon: 21.2 }, { lat: 45.76, lon: 21.21 }]);
    const b = encodePolyline([{ lat: 45.74, lon: 21.2 }, { lat: 45.73, lon: 21.21 }]);
    const drawn = decodeShapes(
      [
        { route: '1', routeName: '1', type: 'TRAM', color: null, polylines: [a] },
        { route: '1', routeName: '1', type: 'TRAM', color: null, polylines: [b] },
      ],
      decodePolyline,
    );
    expect(drawn).toHaveLength(1);
    expect(drawn[0].paths).toHaveLength(2);
  });

  it('labels speeds', () => {
    expect(speedLabel(null)).toBe('Unknown');
    expect(speedLabel(0.4)).toBe('Stopped');
    expect(speedLabel(23.6)).toBe('24 km/h');
  });

  it('keeps the route of a vehicle tapped on directions', () => {
    const d = { coords: { lat: 1, lon: 2 }, title: 'X' };
    expect(destinationOf({ type: 'destination', destination: d })).toBe(d);
    expect(destinationOf({ type: 'vehicle', id: 'a', route: '1', vehicle: vehicle(), returnTo: d })).toBe(d);
    expect(destinationOf({ type: 'vehicle', id: 'a', route: '1', vehicle: vehicle() })).toBeNull();
    expect(destinationOf({ type: 'stop', id: '1' })).toBeNull();
    expect(destinationOf(null)).toBeNull();
  });
});

describe('mock /transit vehicles and shapes', () => {
  it('answers every live vehicle without a route, each with its line', async () => {
    const all = await call('/transit/vehicles');
    expect(all.route).toBeNull();
    expect(all.vehicles).toHaveLength(8); // 4 running lines x 2
    expect(new Set(all.vehicles.map((v: any) => v.route))).toEqual(new Set(['1', '2', '8', '14']));
    expect(all.vehicles.find((v: any) => v.route === '14')).toMatchObject({ routeName: '14', type: 'TROLLEYBUS', color: '#1e88e5' });
  });

  it('answers one path per line through its stops, or one line on request', async () => {
    const shapes = await call('/transit/shapes');
    expect(shapes.map((s: any) => s.route)).toEqual(MOCK_ROUTES.map((r) => r.id));
    expect(decodePolyline(shapes[0].polylines[0])).toHaveLength(LINE_STOPS['1'].length);
    expect(await call('/transit/shapes', { route: 'e4' })).toHaveLength(1);
    expect(await call('/transit/shapes', { route: 'nope' })).toEqual([]);
  });
});

describe('TransitLayer', () => {
  const shapes: TransitShape[] = [
    { route: '1', routeName: '1', type: 'TRAM', color: '#e3a900', polylines: [encodePolyline([{ lat: 45.75, lon: 21.2 }, { lat: 45.76, lon: 21.21 }])] },
    { route: 'E4', routeName: 'E4', type: 'EXPRESS', color: null, polylines: [encodePolyline([{ lat: 45.74, lon: 21.2 }, { lat: 45.75, lon: 21.23 }])] },
  ];
  const vehicles = [vehicle({ id: 'a', route: '1' }), vehicle({ id: 'b', route: 'E4', routeName: 'E4', type: 'EXPRESS', color: null })];
  const line1: TransitRoute = { id: '1', type: 'TRAM', name: '1', from: null, to: null, color: '#e3a900' };

  it('draws every line in its own palette colour and every vehicle', () => {
    const onSelectVehicle = jest.fn();
    render(<TransitLayer stops={undefined} line={null} vehicles={vehicles} shapes={shapes} onSelectStop={jest.fn()} onSelectVehicle={onSelectVehicle} />);
    expect(screen.getByTestId('shape-line-1-0').props.strokeColor).toBe(withAlpha(lineColor('1'), 0.8));
    expect(screen.getByTestId('shape-line-E4-0').props.strokeColor).toBe(withAlpha(lineColor('E4'), 0.8));
    expect(screen.getByTestId('shape-line-1-0').props.strokeWidth).toBe(SHAPE_WIDTH.normal);
    expect(vehicleMarkers()).toHaveLength(2);
    expect(screen.getByLabelText('Express bus E4')).toBeTruthy();
    expect(screen.getByLabelText('Tram 1')).toBeTruthy();
    fireEvent.press(screen.getByTestId('vehicle-marker-b'));
    expect(onSelectVehicle).toHaveBeenCalledWith(vehicles[1]);
  });

  it('highlights a chosen line, fades the others and shows only its vehicles', () => {
    render(<TransitLayer stops={undefined} line={line1} vehicles={vehicles} shapes={shapes} selectedVehicleId="a" onSelectStop={jest.fn()} onSelectVehicle={jest.fn()} />);
    const chosen = screen.getByTestId('shape-line-1-0');
    expect(chosen.props.strokeWidth).toBe(SHAPE_WIDTH.chosen);
    expect(chosen.props.strokeColor).toBe(lineColor('1'));
    expect(screen.getByTestId('shape-line-E4-0').props.strokeWidth).toBe(SHAPE_WIDTH.faded);
    // The chosen line is drawn last, above the others.
    expect(shapeLines().map((l) => l.props.testID)).toEqual(['shape-line-E4-0', 'shape-line-1-0']);
    expect(vehicleMarkers().map((m) => m.props.testID)).toEqual(['vehicle-marker-a']);
    expect(screen.getByTestId('vehicle-marker-a').props.zIndex).toBe(30);
  });

  it('redraws vehicle markers only briefly after they appear (Android snapshot)', () => {
    jest.useFakeTimers();
    try {
      render(<TransitLayer stops={undefined} line={null} vehicles={vehicles} shapes={undefined} onSelectStop={jest.fn()} onSelectVehicle={jest.fn()} />);
      expect(screen.getByTestId('vehicle-marker-a').props.tracksViewChanges).toBe(true);
      act(() => jest.advanceTimersByTime(1000));
      expect(screen.getByTestId('vehicle-marker-a').props.tracksViewChanges).toBe(false);
    } finally {
      jest.useRealTimers();
    }
  });
});

describe('VehiclePanel', () => {
  /** Renders the map panel with a vehicle selected (MapPanel reads the selection from the provider). */
  function renderPanel(v: TransitVehicle) {
    const client = createQueryClient();
    client.setDefaultOptions({ queries: { retry: false, gcTime: Infinity } });
    /** Selects the vehicle once mounted. */
    function Opener() {
      const { select } = useMapContext();
      useEffect(() => select({ type: 'vehicle', id: v.id, route: v.route, vehicle: v }), [select]);
      return null;
    }
    return render(
      <QueryClientProvider client={client}>
        <MapProvider userPosition={{ lat: 45.75, lon: 21.22 }} initialBbox={{ minLat: 45.7, minLon: 21.1, maxLat: 45.8, maxLon: 21.3 }}>
          <Opener />
          <MapPanel />
        </MapProvider>
      </QueryClientProvider>,
    );
  }

  it('shows the line, type, direction, next stop, speed, accessibility and last report of the live vehicle', async () => {
    const live = (await call('/transit/vehicles', { route: '14' })).vehicles[0];
    renderPanel(live);
    const panel = within(await screen.findByTestId('vehicle-panel'));
    expect(panel.getByText(`Trolleybus 14 → ${live.headsign}`)).toBeTruthy();
    expect(panel.getByText('TROLLEYBUS')).toBeTruthy();
    expect(within(panel.getByTestId('vehicle-next-stop')).getByText(live.nextStop)).toBeTruthy();
    expect(within(panel.getByTestId('vehicle-speed')).getByText('18 km/h')).toBeTruthy();
    expect(within(panel.getByTestId('vehicle-accessible')).getByText('Yes, low floor')).toBeTruthy();
    expect(within(panel.getByTestId('vehicle-reported')).getByText(/ago|just now/)).toBeTruthy();
    await waitFor(() => expect(panel.getByText('LIVE')).toBeTruthy());
    expect(panel.queryByTestId('vehicle-stale')).toBeNull();
    expect(panel.queryByText('Back to directions')).toBeNull();
  });

  it('warns when the vehicle no longer reports', async () => {
    renderPanel(vehicle({ id: 'gone-1', route: '1' }));
    const panel = within(await screen.findByTestId('vehicle-panel'));
    expect(await panel.findByText(/no longer reporting/)).toBeTruthy();
  });

  it('warns when STPT is not answering (stale positions)', async () => {
    const real = mocks.mockRequest;
    jest.spyOn(mocks, 'mockRequest').mockImplementation(async (method, path, query, body) => {
      const res = (await real(method, path, query, body)) as any;
      return path === '/transit/vehicles' ? { ...res, stale: true } : res;
    });
    const live = (await call('/transit/vehicles', { route: '1' })).vehicles[0];
    renderPanel(live);
    const panel = within(await screen.findByTestId('vehicle-panel'));
    expect(await panel.findByText(/Live positions are delayed/)).toBeTruthy();
    expect(panel.queryByText('LIVE')).toBeNull();
  });

  it('warns about an old report', async () => {
    const live = (await call('/transit/vehicles', { route: '1' })).vehicles[0];
    jest.spyOn(mocks, 'mockRequest').mockImplementation(async () => ({ route: '1', updatedAt: '', stale: false, vehicles: [{ ...live, reportedAt: new Date(Date.now() - 10 * 60_000).toISOString() }] }));
    renderPanel(live);
    const panel = within(await screen.findByTestId('vehicle-panel'));
    expect(await panel.findByText('This position may be out of date.')).toBeTruthy();
    expect(within(panel.getByTestId('vehicle-reported')).getByText('10 min ago')).toBeTruthy();
  });
});

describe('MapScreen live transit', () => {
  it('Transport draws every line and every live vehicle; a line chip narrows them; a tap opens the vehicle panel', async () => {
    renderScreen(<MapScreen />);
    await moveTo(0.2); // zoomed out: no stops, but lines and vehicles still show
    expect(shapeLines()).toHaveLength(0);
    fireEvent.press(screen.getByTestId('chip-transit'));
    await waitFor(() => expect(shapeLines()).toHaveLength(MOCK_ROUTES.length));
    await waitFor(() => expect(vehicleMarkers()).toHaveLength(8));

    fireEvent.press(await screen.findByTestId('chip-line-14'));
    await waitFor(() => expect(vehicleMarkers()).toHaveLength(2));
    expect(screen.getByTestId('shape-line-14-0').props.strokeWidth).toBe(SHAPE_WIDTH.chosen);
    expect(screen.getByTestId('shape-line-1-0').props.strokeWidth).toBe(SHAPE_WIDTH.faded);

    fireEvent.press(vehicleMarkers()[0]);
    const panel = within(await screen.findByTestId('vehicle-panel'));
    expect(panel.getByText(/^Trolleybus 14/)).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Close panel'));
    await waitFor(() => expect(screen.queryByTestId('vehicle-panel')).toBeNull());

    fireEvent.press(screen.getByTestId('chip-transit')); // Transport off: everything goes
    await waitFor(() => expect(vehicleMarkers()).toHaveLength(0));
    expect(shapeLines()).toHaveLength(0);
  });

  it('closes a transport-layer vehicle panel when another line is chosen or Transport is turned off', async () => {
    renderScreen(<MapScreen />);
    await moveTo(0.2);
    fireEvent.press(screen.getByTestId('chip-transit'));
    fireEvent.press(await screen.findByTestId('chip-line-14'));
    await waitFor(() => expect(vehicleMarkers()).toHaveLength(2));
    fireEvent.press(vehicleMarkers()[0]);
    await screen.findByTestId('vehicle-panel');

    fireEvent.press(screen.getByTestId('chip-line-14')); // same line again (or all lines): its vehicle stays drawn
    expect(screen.getByTestId('vehicle-panel')).toBeTruthy();
    fireEvent.press(await screen.findByTestId('chip-line-14'));
    fireEvent.press(screen.getByTestId('chip-line-1')); // another line: the vehicle is gone, so is its panel
    await waitFor(() => expect(screen.queryByTestId('vehicle-panel')).toBeNull());

    await waitFor(() => expect(vehicleMarkers().length).toBeGreaterThan(0));
    fireEvent.press(vehicleMarkers()[0]);
    await screen.findByTestId('vehicle-panel');
    fireEvent.press(screen.getByTestId('chip-transit')); // Transport off
    await waitFor(() => expect(screen.queryByTestId('vehicle-panel')).toBeNull());
  });

  it('asks for every vehicle in one request and the shapes once', async () => {
    const spy = jest.spyOn(mocks, 'mockRequest');
    renderScreen(<MapScreen />);
    await moveTo(0.2);
    fireEvent.press(screen.getByTestId('chip-transit'));
    await waitFor(() => expect(vehicleMarkers()).toHaveLength(8));
    const vehicleCalls = spy.mock.calls.filter((c) => c[1] === '/transit/vehicles');
    expect(vehicleCalls.length).toBeGreaterThan(0);
    expect(vehicleCalls.every((c) => c[2] && (c[2] as any).route === undefined)).toBe(true);
    expect(spy.mock.calls.filter((c) => c[1] === '/transit/shapes')).toHaveLength(1);
  });

  it('shows the live vehicles of the route lines with directions, even with Transport off, and their panel', async () => {
    renderScreen(<MapScreen />);
    fireEvent(screen.getByTestId('main-map'), 'longPress', { nativeEvent: { coordinate: { latitude: 45.7275, longitude: 21.2355 } } });
    const directions = within(await screen.findByTestId('directions-panel'));
    await waitFor(() => expect(directions.getAllByTestId('route-leg')).toHaveLength(3));
    await waitFor(() => expect(legVehicleMarkers()).toHaveLength(2));
    expect(vehicleMarkers()).toHaveLength(0); // the Transport layer itself is off
    expect(await directions.findByText(/^Live: tram \d+ is .+ from /)).toBeTruthy();

    fireEvent.press(legVehicleMarkers()[0]);
    const panel = within(await screen.findByTestId('vehicle-panel'));
    expect(panel.getByText(/^Tram \d+/)).toBeTruthy();
    expect(screen.getByTestId('destination-marker')).toBeTruthy(); // the route stays drawn
    fireEvent.press(panel.getByText('Back to directions'));
    expect(await screen.findByTestId('directions-panel')).toBeTruthy();

    fireEvent.press(await screen.findByTestId('next-vehicle'));
    expect(await screen.findByTestId('vehicle-panel')).toBeTruthy();
  });

  it('does not draw a route vehicle twice when Transport already shows it', async () => {
    renderScreen(<MapScreen />);
    await moveTo(0.2);
    fireEvent.press(screen.getByTestId('chip-transit'));
    await waitFor(() => expect(vehicleMarkers()).toHaveLength(8));
    fireEvent(screen.getByTestId('main-map'), 'longPress', { nativeEvent: { coordinate: { latitude: 45.7275, longitude: 21.2355 } } });
    await screen.findByTestId('directions-panel');
    await waitFor(() => expect(screen.getAllByTestId(/^route-line-/)).toHaveLength(3));
    await new Promise((r) => setTimeout(r, 50));
    expect(legVehicleMarkers()).toHaveLength(0);
    expect(vehicleMarkers()).toHaveLength(8);
  });
});
