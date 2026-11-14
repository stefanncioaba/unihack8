// Live transit on the map: every live vehicle (no route lines until a line is picked), the vehicle panel, and the live
// vehicles of a route's ride legs in directions and journey mode. Helpers (colours, leg -> line mapping, ages) are
// tested directly. The one-line view (picker, Tur / Retur) is in map.lineView.test.tsx.
import { QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { useEffect } from 'react';

import type { RouteLeg } from '@/api/types.routing';
import type { TransitRoute, TransitShape, TransitVehicle } from '@/api/types.transit';
import MapScreen from '@/app/(tabs)/map';
import { MapProvider, destinationOf, useMapContext } from '@/features/map/MapContext';
import { MapPanel } from '@/features/map/MapPanel';
import {
  FAMILY_PALETTES,
  LINE_PALETTE,
  clearLineTypes,
  decodeShapes,
  guessLineFamily,
  lineFamily,
  registerLineTypes,
  textOnColor,
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
import { lineDirections } from '@/features/transit/lineView';
import { ROUTE_STYLE, TransitLayer } from '@/features/transit/TransitLayer';
import { vehicleImages } from '@/features/transit/VehicleMarker';
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
const routeLines = () => screen.queryAllByTestId(/^(shape-line-|line-route-)/);

afterEach(() => jest.restoreAllMocks());

describe('line helpers', () => {
  afterEach(() => clearLineTypes());

  it('gives every line a stable shade of its own (STPT colours every tram the same)', () => {
    const e4 = lineColor('E4');
    expect(LINE_PALETTE).toContain(e4);
    expect(lineColor('e4 ')).toBe(e4); // same line in another case: same colour
    expect(LINE_PALETTE).toContain(lineColor(null));
    const colours = new Set(['E1', 'E2', 'E3', 'E4', 'E6', 'E7', 'E8', 'M14', 'M30', '33'].map((r) => lineColor(r)));
    expect(colours.size).toBeGreaterThan(5);
    expect(lineColor('1')).not.toBe(lineColor('2'));
  });

  it('colours each line from its type family (trams yellow, trolleybuses purple, buses teal, express orange ...)', () => {
    registerLineTypes([
      { id: '1', type: 'TRAM' },
      { id: '2', type: 'TRAM' },
      { id: '14', type: 'TROLLEYBUS' },
      { id: '33', type: 'BUS' },
      { id: '77', type: 'EXPRESS' },
      { id: 'X1', type: 'SCHOOL' },
    ]);
    registerLineTypes([{ route: 'M30', type: 'METROPOLITAN' }, { route: null, type: 'BUS' }]); // vehicles carry `route`
    expect(FAMILY_PALETTES.TRAM).toContain(lineColor('1'));
    expect(FAMILY_PALETTES.TRAM).toContain(lineColor('2'));
    expect(lineColor('1')).not.toBe(lineColor('2')); // same family, own shade
    expect(FAMILY_PALETTES.TROLLEYBUS).toContain(lineColor('14'));
    expect(FAMILY_PALETTES.BUS).toContain(lineColor('33'));
    expect(FAMILY_PALETTES.EXPRESS).toContain(lineColor('77'));
    expect(FAMILY_PALETTES.SCHOOL).toContain(lineColor('x1'));
    expect(FAMILY_PALETTES.METROPOLITAN).toContain(lineColor('M30'));
    // Consecutive lines of a family get different shades.
    const trams = ['1', '2', '4', '5', '6', '7', '8', '9'];
    registerLineTypes(trams.map((id) => ({ id, type: 'TRAM' as const })));
    expect(new Set(trams.map(lineColor)).size).toBe(trams.length);
    // The first type learnt for a line sticks.
    registerLineTypes([{ id: '1', type: 'BUS' }]);
    expect(lineFamily('1')).toBe('TRAM');
  });

  it('guesses the family from the line name until its type is known', () => {
    expect(guessLineFamily('E2')).toBe('EXPRESS');
    expect(guessLineFamily('m14')).toBe('METROPOLITAN');
    expect(guessLineFamily('S3')).toBe('SCHOOL');
    expect(guessLineFamily('Tv4')).toBe('TRAM');
    expect(guessLineFamily('Tb15')).toBe('TROLLEYBUS');
    expect(guessLineFamily('33')).toBe('BUS');
    expect(lineFamily('E2')).toBe('EXPRESS');
    expect(FAMILY_PALETTES.EXPRESS).toContain(lineColor('E2'));
  });

  it('picks readable text on line colours', () => {
    expect(textOnColor('#FFD700')).toBe('#000814'); // ink on yellow
    expect(textOnColor('#7B1FA2')).toBe('#fff'); // white on purple
    expect(textOnColor('red')).toBe('#fff');
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

  it('answers Tur and Retur through each line\'s stops, with the stops only for one line', async () => {
    const shapes = await call('/transit/shapes');
    expect(shapes.map((s: any) => s.route)).toEqual(MOCK_ROUTES.map((r) => r.id));
    expect(decodePolyline(shapes[0].polylines[0])).toHaveLength(LINE_STOPS['1'].length);
    expect(shapes[0].variants.map((v: any) => [v.direction, v.headsign, v.stops])).toEqual([
      ['TUR', MOCK_ROUTES[0].to, null],
      ['RETUR', MOCK_ROUTES[0].from, null],
    ]);
    const [one] = await call('/transit/shapes', { route: 'e4' });
    expect(one.route).toBe('E4');
    expect(one.variants[0].stops.map((st: any) => st.id)).toEqual(LINE_STOPS.E4);
    expect(one.variants[1].stops.map((st: any) => st.id)).toEqual([...LINE_STOPS.E4].reverse());
    expect(await call('/transit/shapes', { route: 'nope' })).toEqual([]);
  });

  it('gives running vehicles a bearing towards their next stop', async () => {
    const all = await call('/transit/vehicles');
    expect(all.vehicles.some((v: any) => typeof v.bearing === 'number' && v.bearing >= 0 && v.bearing < 360)).toBe(true);
  });
});

describe('TransitLayer', () => {
  const shapes: TransitShape[] = [
    {
      route: '1',
      routeName: '1',
      type: 'TRAM',
      color: '#e3a900',
      polylines: [],
      variants: [
        {
          polyline: encodePolyline([{ lat: 45.75, lon: 21.2 }, { lat: 45.76, lon: 21.21 }]),
          direction: 'TUR',
          headsign: 'Gara de Nord',
          stops: [
            { id: 's1', name: 'A', lat: 45.75, lon: 21.2 },
            { id: 's2', name: 'Gara de Nord', lat: 45.76, lon: 21.21 },
          ],
        },
        {
          polyline: encodePolyline([{ lat: 45.76, lon: 21.21 }, { lat: 45.75, lon: 21.2 }]),
          direction: 'RETUR',
          headsign: 'A',
          stops: [
            { id: 's2', name: 'Gara de Nord', lat: 45.76, lon: 21.21 },
            { id: 's1', name: 'A', lat: 45.75, lon: 21.2 },
          ],
        },
      ],
    },
  ];
  const directions = lineDirections(shapes, '1', decodePolyline);
  const vehicles = [
    vehicle({ id: 'a', route: '1', headsign: 'Gara de Nord' }),
    vehicle({ id: 'back', route: '1', headsign: 'A' }),
    vehicle({ id: 'b', route: 'E4', routeName: 'E4', type: 'EXPRESS', color: null }),
  ];

  it('draws every live vehicle and no route lines while no line is chosen', () => {
    const onSelectVehicle = jest.fn();
    render(<TransitLayer stops={undefined} lineId={null} vehicles={vehicles} onSelectStop={jest.fn()} onSelectVehicle={onSelectVehicle} />);
    expect(routeLines()).toHaveLength(0);
    expect(vehicleMarkers()).toHaveLength(3);
    // Each vehicle is the ready-made badge of its line.
    expect(screen.getByTestId('vehicle-marker-b').props.image).toBe(vehicleImages(vehicles[2]).normal);
    expect(screen.getByTestId('vehicle-marker-a').props.image).toBe(vehicleImages(vehicles[0]).normal);
    expect(screen.getByTestId('vehicle-marker-back').props.image).toBe(vehicleImages(vehicles[1]).normal);
    fireEvent.press(screen.getByTestId('vehicle-marker-b'));
    expect(onSelectVehicle).toHaveBeenCalledWith(vehicles[2]);
  });

  it('draws the chosen line one direction at a time: thick line over a faint halo, its stops and its vehicles', () => {
    const onSelectStop = jest.fn();
    const { rerender } = render(
      <TransitLayer stops={undefined} lineId="1" directions={directions} directionIndex={0} vehicles={vehicles} selectedVehicleId="a" onSelectStop={onSelectStop} onSelectVehicle={jest.fn()} />,
    );
    const line = screen.getByTestId('line-route-1');
    const halo = screen.getByTestId('line-route-halo-1');
    expect(line.props.strokeWidth).toBe(ROUTE_STYLE.width);
    expect(line.props.strokeColor).toBe(lineColor('1'));
    expect(halo.props.strokeWidth).toBeGreaterThan(line.props.strokeWidth);
    expect(halo.props.strokeColor).toBe(withAlpha(lineColor('1'), ROUTE_STYLE.haloOpacity));
    expect(line.props.coordinates[0]).toEqual({ latitude: 45.75, longitude: 21.2 });
    // Only the vehicles of line 1 heading to Gara de Nord, and the stops of that direction.
    expect(vehicleMarkers().map((m) => m.props.testID)).toEqual(['vehicle-marker-a']);
    expect(screen.getByTestId('vehicle-marker-a').props.zIndex).toBe(30);
    expect(screen.queryAllByTestId(/^stop-marker-/).map((m) => m.props.testID)).toEqual(['stop-marker-s1', 'stop-marker-s2']);
    fireEvent.press(screen.getByTestId('stop-marker-s2'));
    expect(onSelectStop).toHaveBeenCalledWith('s2');

    // Retur: the reversed path and the other vehicle.
    rerender(<TransitLayer stops={undefined} lineId="1" directions={directions} directionIndex={1} vehicles={vehicles} onSelectStop={onSelectStop} onSelectVehicle={jest.fn()} />);
    expect(screen.getByTestId('line-route-1').props.coordinates[0]).toEqual({ latitude: 45.76, longitude: 21.21 });
    expect(vehicleMarkers().map((m) => m.props.testID)).toEqual(['vehicle-marker-back']);
  });

  it('shows the visible stops of the chosen line and its vehicles while its shape loads', () => {
    const stops = [
      { id: 'x', name: 'X', lat: 45.75, lon: 21.22, routes: ['1'] },
      { id: 'y', name: 'Y', lat: 45.75, lon: 21.22, routes: ['E4'] },
    ];
    render(<TransitLayer stops={stops} lineId="1" directions={[]} vehicles={vehicles} onSelectStop={jest.fn()} onSelectVehicle={jest.fn()} />);
    expect(routeLines()).toHaveLength(0);
    expect(screen.queryAllByTestId(/^stop-marker-/).map((m) => m.props.testID)).toEqual(['stop-marker-x']);
    expect(vehicleMarkers()).toHaveLength(2);
  });

  it('vehicle markers are images with no view tracking (nothing to snapshot)', () => {
    render(<TransitLayer stops={undefined} lineId={null} vehicles={vehicles} onSelectStop={jest.fn()} onSelectVehicle={jest.fn()} />);
    expect(screen.getByTestId('vehicle-marker-a').props.tracksViewChanges).toBe(false);
    expect(screen.getByTestId('vehicle-marker-a').props.image).toBeDefined();
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
  it('Transport draws only the live vehicles (no route lines); a tap opens the panel and shows that line', async () => {
    renderScreen(<MapScreen />);
    await moveTo(0.2); // zoomed out: no stops, but vehicles still show
    fireEvent.press(screen.getByTestId('chip-transit'));
    fireEvent.press(await screen.findByTestId('line-group-TRAM')); // trams are chosen to start with: press again for every type
    await waitFor(() => expect(vehicleMarkers()).toHaveLength(8));
    expect(routeLines()).toHaveLength(0);

    fireEvent.press(vehicleMarkers().find((m) => m.props.testID.startsWith('vehicle-marker-14-'))!);
    const panel = within(await screen.findByTestId('vehicle-panel'));
    expect(panel.getByText(/^Trolleybus 14/)).toBeTruthy();
    // Its line is shown alone: its route, only its vehicles.
    expect(await screen.findByTestId('line-route-14')).toBeTruthy();
    await waitFor(() => expect(vehicleMarkers().every((m) => m.props.testID.startsWith('vehicle-marker-14-'))).toBe(true));
    fireEvent.press(screen.getByLabelText('Close panel'));
    await waitFor(() => expect(screen.queryByTestId('vehicle-panel')).toBeNull());

    fireEvent.press(screen.getByTestId('chip-transit')); // Transport off: everything goes
    await waitFor(() => expect(vehicleMarkers()).toHaveLength(0));
    expect(routeLines()).toHaveLength(0);
  });

  it('closes a transport-layer vehicle panel when Transport is turned off', async () => {
    renderScreen(<MapScreen />);
    await moveTo(0.2);
    fireEvent.press(screen.getByTestId('chip-transit'));
    await waitFor(() => expect(vehicleMarkers().length).toBeGreaterThan(0));
    fireEvent.press(vehicleMarkers()[0]);
    await screen.findByTestId('vehicle-panel');
    fireEvent.press(screen.getByTestId('chip-transit')); // Transport off
    await waitFor(() => expect(screen.queryByTestId('vehicle-panel')).toBeNull());
  });

  it('asks for every vehicle in one request and no shapes until a line is picked', async () => {
    const spy = jest.spyOn(mocks, 'mockRequest');
    renderScreen(<MapScreen />);
    await moveTo(0.2);
    fireEvent.press(screen.getByTestId('chip-transit'));
    fireEvent.press(await screen.findByTestId('line-group-TRAM')); // trams are chosen to start with: press again for every type
    await waitFor(() => expect(vehicleMarkers()).toHaveLength(8));
    const vehicleCalls = spy.mock.calls.filter((c) => c[1] === '/transit/vehicles');
    expect(vehicleCalls.length).toBeGreaterThan(0);
    expect(vehicleCalls.every((c) => c[2] && (c[2] as any).route === undefined)).toBe(true);
    expect(spy.mock.calls.filter((c) => c[1] === '/transit/shapes')).toHaveLength(0); // not the whole network
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

  it('with Transport on, directions hide the network and draw only the vehicles of the route lines (each once)', async () => {
    renderScreen(<MapScreen />);
    await moveTo(0.2);
    fireEvent.press(screen.getByTestId('chip-transit'));
    fireEvent.press(await screen.findByTestId('line-group-TRAM')); // trams are chosen to start with: press again for every type
    await waitFor(() => expect(vehicleMarkers()).toHaveLength(8));
    fireEvent(screen.getByTestId('main-map'), 'longPress', { nativeEvent: { coordinate: { latitude: 45.7275, longitude: 21.2355 } } });
    await screen.findByTestId('directions-panel');
    await waitFor(() => expect(screen.getAllByTestId(/^route-line-/)).toHaveLength(3));
    // Directions mode turns the Transport layer off, so only the ride legs' live vehicles are drawn (no duplicates).
    await waitFor(() => expect(vehicleMarkers()).toHaveLength(0));
    await waitFor(() => expect(legVehicleMarkers().length).toBeGreaterThan(0));
    const ids = legVehicleMarkers().map((m) => m.props.testID);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
