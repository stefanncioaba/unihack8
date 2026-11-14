// One-line view of the Transport layer (like live.stpt.ro): lines grouped by type in the picker, one direction at a
// time with a Tur / Retur toggle, the line's stops and only its vehicles, a clear (x) back to every vehicle, and the
// line's shape fetched only when it is picked.
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';

import type { TransitRoute, TransitShape, TransitVehicle } from '@/api/types.transit';
import MapScreen from '@/app/(tabs)/map';
import { LinePicker } from '@/features/transit/LinePicker';
import { directionLabel, directionOfVehicle, groupLines, lineDirections, sameHeadsign, vehiclesInDirection } from '@/features/transit/lineView';
import { isMapMoving } from '@/features/transit/vehicleAnimation';
import { decodePolyline, encodePolyline } from '@/lib/polyline';
import * as mocks from '@test/mocks';
import { LINE_STOPS, MOCK_ROUTES } from '@test/mocks/transitSeed';

import { renderScreen } from './testUtils';

const vehicleMarkers = () => screen.queryAllByTestId(/^vehicle-marker-/);
const stopMarkers = () => screen.queryAllByTestId(/^stop-marker-/);

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
    headsign: null,
    nextStop: null,
    accessible: true,
    reportedAt: new Date().toISOString(),
    ...over,
  };
}

const path = (n: number) => encodePolyline(Array.from({ length: n }, (_, i) => ({ lat: 45.75 + i * 0.001, lon: 21.2 })));
const stop = (id: string) => ({ id, name: id, lat: 45.75, lon: 21.2 });

/** Moves the mocked map to a region and waits for the debounce + reload. */
async function moveTo(latitudeDelta: number) {
  await act(async () => {
    fireEvent(screen.getByTestId('main-map'), 'regionChangeComplete', { latitude: 45.752, longitude: 21.225, latitudeDelta, longitudeDelta: latitudeDelta });
    await new Promise((r) => setTimeout(r, 400));
  });
}

afterEach(() => jest.restoreAllMocks());

describe('line view helpers', () => {
  it('groups lines by type, trams first, keeping the list order', () => {
    const routes: TransitRoute[] = [
      { id: 'E4', type: 'EXPRESS', name: 'E4', from: null, to: null, color: null },
      { id: '1', type: 'TRAM', name: '1', from: null, to: null, color: null },
      { id: '14', type: 'TROLLEYBUS', name: '14', from: null, to: null, color: null },
      { id: '2', type: 'TRAM', name: '2', from: null, to: null, color: null },
    ];
    const groups = groupLines(routes);
    expect(groups.map((g) => g.type)).toEqual(['TRAM', 'TROLLEYBUS', 'EXPRESS']);
    expect(groups[0]).toMatchObject({ label: 'Trams', icon: 'train' });
    expect(groups[0].lines.map((l) => l.id)).toEqual(['1', '2']);
    expect(groupLines(undefined)).toEqual([]);
  });

  it('picks the main path of Tur and of Retur (most stops), Tur first', () => {
    const shapes: TransitShape[] = [
      {
        route: '1',
        routeName: '1',
        type: 'TRAM',
        color: null,
        polylines: [],
        variants: [
          { polyline: path(3), direction: 'RETUR', headsign: 'A', stops: [stop('c'), stop('a')] },
          { polyline: path(2), direction: 'TUR', headsign: 'Depou', stops: [stop('a')] }, // short-turn variant
          { polyline: path(4), direction: 'TUR', headsign: 'Gara de Nord', stops: [stop('a'), stop('b'), stop('c')] },
          { polyline: path(1), direction: 'TUR', headsign: 'Broken', stops: [] }, // one point: dropped
        ],
      },
      { route: '2', routeName: '2', type: 'TRAM', color: null, polylines: [path(5)] }, // another line
    ];
    const dirs = lineDirections(shapes, '1', decodePolyline);
    expect(dirs.map((d) => [d.direction, d.headsign, d.label, d.stops.length, d.path.length])).toEqual([
      ['TUR', 'Gara de Nord', '→ Gara de Nord', 3, 4],
      ['RETUR', 'A', '→ A', 2, 3],
    ]);
    expect(new Set(dirs.map((d) => d.key)).size).toBe(2);
    expect(lineDirections(shapes, null, decodePolyline)).toEqual([]);
    expect(lineDirections(undefined, '1', decodePolyline)).toEqual([]);
  });

  it('stands two paths in for the directions when the data has none', () => {
    const old: TransitShape[] = [{ route: '1', routeName: '1', type: 'TRAM', color: null, polylines: [path(3), path(4), path(5)] }];
    const dirs = lineDirections(old, '1', decodePolyline);
    expect(dirs.map((d) => d.label)).toEqual(['Tur', 'Retur']);
    expect(dirs.map((d) => d.path.length)).toEqual([3, 4]);
    expect(directionLabel('RETUR', null, 0)).toBe('Retur');
    expect(directionLabel('TUR', '  ', 1)).toBe('Tur');
  });

  it('matches headsigns ignoring case, diacritics and extra words, but not single letters inside words', () => {
    expect(sameHeadsign('Piața Traian', 'piata traian')).toBe(true);
    expect(sameHeadsign('Piața Gh. Domășneanu (AEM)', 'Piata Gh Domasneanu')).toBe(true);
    expect(sameHeadsign('Gara de Nord', 'A')).toBe(false);
    expect(sameHeadsign(null, 'A')).toBe(false);
  });

  it('keeps the vehicles of the shown direction, or all of them when headsigns do not tell', () => {
    const shapes: TransitShape[] = [
      {
        route: '1',
        routeName: '1',
        type: 'TRAM',
        color: null,
        polylines: [],
        variants: [
          { polyline: path(2), direction: 'TUR', headsign: 'Gara de Nord', stops: [] },
          { polyline: path(2), direction: 'RETUR', headsign: 'Piața Traian', stops: [] },
        ],
      },
    ];
    const dirs = lineDirections(shapes, '1', decodePolyline);
    const there = vehicle({ id: 'there', headsign: 'Gara de Nord' });
    const back = vehicle({ id: 'back', headsign: 'Piata Traian' });
    expect(vehiclesInDirection([there, back], dirs, 0).map((v) => v.id)).toEqual(['there']);
    expect(vehiclesInDirection([there, back], dirs, 1).map((v) => v.id)).toEqual(['back']);
    const unknown = [vehicle({ id: 'x', headsign: null }), vehicle({ id: 'y', headsign: 'Somewhere' })];
    expect(vehiclesInDirection(unknown, dirs, 1)).toBe(unknown);
    expect(directionOfVehicle(dirs, 'piata traian')).toBe(1);
    expect(directionOfVehicle(dirs, null)).toBe(0);
  });
});

describe('LinePicker', () => {
  const routes = MOCK_ROUTES;

  it('shows type groups with a tile per line and picks one', () => {
    const onPick = jest.fn();
    render(<LinePicker routes={routes} mode="TRAM" onMode={jest.fn()} lineId={null} directions={[]} directionIndex={0} onPick={onPick} onDirection={jest.fn()} />);
    expect(screen.getByTestId('line-group-TRAM')).toBeTruthy(); // a button per vehicle type, with its legend name
    expect(screen.getByText('Tram')).toBeTruthy();
    expect(screen.getByText('Trolley')).toBeTruthy();
    // Only the chosen type's lines are listed.
    expect(within(screen.getByTestId('line-tiles')).getByTestId('line-tile-1')).toBeTruthy();
    expect(screen.queryByTestId('line-tile-14')).toBeNull();
    fireEvent.press(screen.getByLabelText('Show line 1'));
    expect(onPick).toHaveBeenCalledWith('1');
  });

  it('shows the chosen line with its direction toggle and a clear button', () => {
    const onPick = jest.fn();
    const onDirection = jest.fn();
    const dirs = lineDirections(
      [{ route: '1', routeName: '1', type: 'TRAM', color: null, polylines: [], variants: [
        { polyline: path(2), direction: 'TUR', headsign: 'Gara de Nord', stops: [] },
        { polyline: path(2), direction: 'RETUR', headsign: 'Piața Traian', stops: [] },
      ] }],
      '1',
      decodePolyline,
    );
    render(<LinePicker routes={routes} mode="TRAM" onMode={jest.fn()} lineId="1" directions={dirs} directionIndex={1} onPick={onPick} onDirection={onDirection} />);
    const bar = within(screen.getByTestId('line-view'));
    expect(bar.getByText('Tram')).toBeTruthy();
    expect(bar.getByText('→ Gara de Nord')).toBeTruthy();
    expect(screen.getByTestId('line-direction-1').props.accessibilityState).toMatchObject({ selected: true });
    fireEvent.press(screen.getByTestId('line-direction-0'));
    expect(onDirection).toHaveBeenCalledWith(0);
    fireEvent.press(screen.getByTestId('line-clear'));
    expect(onPick).toHaveBeenCalledWith(null);
    expect(screen.queryByTestId('line-picker')).toBeNull();
  });
});

describe('MapScreen line view', () => {
  it('picks a line: one direction with its stops and vehicles, Tur / Retur, then back to every vehicle', async () => {
    const spy = jest.spyOn(mocks, 'mockRequest');
    renderScreen(<MapScreen />);
    await moveTo(0.2);
    expect(screen.queryByTestId('line-picker')).toBeNull(); // only with Transport on
    fireEvent.press(screen.getByTestId('chip-transit'));
    // Trams are chosen to start with: only the trams are drawn; pressing the chosen type again shows every type.
    await waitFor(() => expect(vehicleMarkers().length).toBeGreaterThan(0));
    const trams = vehicleMarkers().length;
    fireEvent.press(screen.getByTestId('line-group-TRAM'));
    await waitFor(() => expect(vehicleMarkers()).toHaveLength(8));
    expect(trams).toBeLessThan(8);
    expect(screen.queryAllByTestId(/^line-route-/)).toHaveLength(0);
    expect(spy.mock.calls.filter((c) => c[1] === '/transit/shapes')).toHaveLength(0);

    fireEvent.press(screen.getByTestId('line-group-TRAM'));
    fireEvent.press(await screen.findByTestId('line-tile-1'));
    expect(await screen.findByTestId('line-route-1')).toBeTruthy();
    expect(screen.getByTestId('line-route-halo-1')).toBeTruthy();
    // The line's shape was fetched for that line only.
    const shapeCalls = spy.mock.calls.filter((c) => c[1] === '/transit/shapes');
    expect(shapeCalls).toHaveLength(1);
    expect((shapeCalls[0][2] as any).route).toBe('1');
    // Tur: its stops in order (even zoomed out) and only line 1's vehicles.
    await waitFor(() => expect(stopMarkers().map((m) => m.props.testID.replace('stop-marker-', ''))).toEqual(LINE_STOPS['1']));
    expect(vehicleMarkers().length).toBeGreaterThan(0);
    expect(vehicleMarkers().every((m) => m.props.testID.startsWith('vehicle-marker-1-'))).toBe(true);
    const line1 = MOCK_ROUTES.find((r) => r.id === '1')!;
    expect(screen.getByText(`→ ${line1.to}`)).toBeTruthy();
    const turStart = screen.getByTestId('line-route-1').props.coordinates[0];

    // Retur: the reversed route and stops.
    fireEvent.press(screen.getByText(`→ ${line1.from}`));
    await waitFor(() => expect(screen.getByTestId('line-route-1').props.coordinates[0]).not.toEqual(turStart));
    expect(stopMarkers().map((m) => m.props.testID.replace('stop-marker-', ''))).toEqual([...LINE_STOPS['1']].reverse());

    // A stop of the line opens the stop panel.
    fireEvent.press(screen.getByTestId(`stop-marker-${LINE_STOPS['1'][0]}`));
    expect(await screen.findByTestId('stop-panel')).toBeTruthy();

    // Clear: every vehicle again, no route.
    fireEvent.press(screen.getByTestId('line-clear'));
    await waitFor(() => expect(vehicleMarkers().length).toBeGreaterThan(0));
    expect(screen.queryAllByTestId(/^line-route-/)).toHaveLength(0);
    expect(screen.getByTestId('line-picker')).toBeTruthy();
  });

  it('forgets the picked line when Transport is turned off', async () => {
    renderScreen(<MapScreen />);
    await moveTo(0.2);
    fireEvent.press(screen.getByTestId('chip-transit'));
    fireEvent.press(await screen.findByTestId('line-group-TROLLEYBUS'));
    fireEvent.press(await screen.findByTestId('line-tile-14'));
    expect(await screen.findByTestId('line-route-14')).toBeTruthy();
    fireEvent.press(screen.getByTestId('chip-transit')); // off
    await waitFor(() => expect(screen.queryByTestId('line-route-14')).toBeNull());
    fireEvent.press(screen.getByTestId('chip-transit')); // on again: fresh panel, trams chosen
    await waitFor(() => expect(vehicleMarkers().length).toBeGreaterThan(0));
    expect(vehicleMarkers().length).toBeLessThan(8);
    expect(screen.queryByTestId('line-view')).toBeNull();
  });

  it('notes the camera moving so vehicles jump instead of gliding while panning', async () => {
    renderScreen(<MapScreen />);
    fireEvent(screen.getByTestId('main-map'), 'regionChange', { latitude: 45.75, longitude: 21.22, latitudeDelta: 0.02, longitudeDelta: 0.02 });
    expect(isMapMoving()).toBe(true);
    await moveTo(0.02);
    expect(isMapMoving()).toBe(false);
  });
});
