// Trip guidance on the map: the pure tripSteps() helper (walk only, one ride, a transfer, missing names / times), the
// approaching-vehicle pick, and the Map tab drawing board / get-off / walk markers for the mock planner's route, both in
// the directions preview and in journey mode.
import { QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import type { RouteLeg } from '@/api/types.routing';
import type { RoutePlan } from '@/api/types.routing';
import type { TransitRoute, TransitVehicle } from '@/api/types.transit';
import MapScreen from '@/app/(tabs)/map';
import { TripStepMarker } from '@/features/directions/TripMarkers';
import { boardLabel, legLineColor, legStrokeColor, pathMidpoint, tripSteps } from '@/features/directions/tripSteps';
import { routeParams } from '@/features/journey/navigation';
import { MARKER_TRACK_MS } from '@/features/map/ClusterMarker';
import { approachingVehicleIds, LegVehicles } from '@/features/transit/LegVehicles';
import { lineColor } from '@/features/transit/lines';
import { VehicleBadge } from '@/features/transit/VehicleMarker';
import { encodePolyline } from '@/lib/polyline';
import * as mocks from '@test/mocks';

import { renderScreen, setParams } from './testUtils';

/** A straight leg between two named points. */
function leg(mode: RouteLeg['mode'], from: [number, number, string], to: [number, number, string], minutes: number, extra: Partial<RouteLeg> = {}): RouteLeg {
  return {
    mode,
    route: null,
    headsign: null,
    from: { name: from[2], lat: from[0], lon: from[1] },
    to: { name: to[2], lat: to[0], lon: to[1] },
    startsAt: null,
    endsAt: null,
    durationMinutes: minutes,
    polyline: encodePolyline([{ lat: from[0], lon: from[1] }, { lat: to[0], lon: to[1] }]),
    ...extra,
  };
}

const START: [number, number, string] = [45.75, 21.22, 'Start'];
const STOP_A: [number, number, string] = [45.755, 21.22, 'Piața Libertății'];
const STOP_B: [number, number, string] = [45.765, 21.22, 'Piața Victoriei'];
const STOP_C: [number, number, string] = [45.766, 21.221, 'Catedrala'];
const STOP_D: [number, number, string] = [45.775, 21.221, 'Gara de Nord'];
const END: [number, number, string] = [45.775, 21.224, 'Destination'];
// 2026-11-14 16:08 UTC = 18:08 in Timișoara (winter time, UTC+2).
const AT = '2026-11-14T16:08:00Z';

/** Labels of the steps, in order. */
const labels = (legs: RouteLeg[], dest?: string) => tripSteps(legs, dest).map((s) => `${s.kind}: ${s.label}`);

describe('tripSteps', () => {
  it('walking only: one "Walk N min to <destination>" label halfway along', () => {
    const steps = tripSteps([leg('WALK', START, END, 12)], 'Pizzeria Napoli');
    expect(steps).toHaveLength(1);
    expect(steps[0]).toMatchObject({ kind: 'walk', key: 'walk-0', label: 'Walk 12 min to Pizzeria Napoli', color: null });
    expect(steps[0].coord.lat).toBeCloseTo((START[0] + END[0]) / 2, 4);
    expect(steps[0].coord.lon).toBeCloseTo((START[1] + END[1]) / 2, 4);
  });

  it('one ride: walk, board with line, headsign and time, get off, final walk', () => {
    const legs = [
      leg('WALK', START, STOP_A, 4),
      leg('TRAM', STOP_A, STOP_D, 9, { route: '1', headsign: 'Gara de Nord', startsAt: AT }),
      leg('WALK', STOP_D, END, 3),
    ];
    expect(labels(legs, 'Iulius Town')).toEqual([
      'walk: Walk 4 min',
      'board: Board Tram 1 → Gara de Nord · 18:08',
      'alight: Get off at Gara de Nord',
      'walk: Walk 3 min to Iulius Town',
    ]);
    const [, board, alight] = tripSteps(legs);
    expect(board).toMatchObject({ coord: { lat: STOP_A[0], lon: STOP_A[1] }, color: lineColor('1'), icon: 'train', mode: 'TRAM' });
    expect(alight).toMatchObject({ coord: { lat: STOP_D[0], lon: STOP_D[1] }, color: lineColor('1') });
  });

  it('a transfer: two rides in their own colours with the walk between them', () => {
    const legs = [
      leg('TRAM', STOP_A, STOP_B, 5, { route: '1', headsign: 'Gara de Nord', startsAt: AT }),
      leg('WALK', STOP_B, STOP_C, 2),
      leg('TROLLEYBUS', STOP_C, STOP_D, 6, { route: '14', headsign: 'Torontalului', startsAt: '2026-11-14T16:20:00Z' }),
    ];
    expect(labels(legs)).toEqual([
      'board: Board Tram 1 → Gara de Nord · 18:08',
      'alight: Get off at Piața Victoriei',
      'walk: Walk 2 min',
      'board: Board Trolleybus 14 → Torontalului · 18:20',
      'alight: Get off at Gara de Nord',
    ]);
    const steps = tripSteps(legs);
    expect(steps.map((s) => s.key)).toEqual(['board-0', 'alight-0', 'walk-1', 'board-2', 'alight-2']);
    expect(steps[3]).toMatchObject({ icon: 'flash', color: lineColor('14') });
    expect(lineColor('1')).not.toBe(lineColor('14'));
  });

  it('copes with missing names, times and places', () => {
    const ride = leg('BUS', STOP_A, STOP_B, 5, { route: '33', headsign: null, startsAt: null });
    expect(boardLabel(ride)).toBe('Board Bus 33 → Piața Victoriei');
    expect(boardLabel({ ...ride, to: null, route: null, startsAt: 'not a time' })).toBe('Board Bus');
    // No named places: the polyline ends are used; no stop name gives "Get off here".
    const noPlaces = { ...ride, from: null, to: null };
    expect(labels([noPlaces])).toEqual(['board: Board Bus 33', 'alight: Get off here']);
    expect(tripSteps([noPlaces])[0].coord).toEqual({ lat: STOP_A[0], lon: STOP_A[1] });
    // No position at all: skipped.
    expect(tripSteps([{ ...ride, from: null, to: null, polyline: null }, { ...ride, mode: 'WALK', from: null, to: null, polyline: null }])).toEqual([]);
    // The planner's generic "Destination" name is not repeated on the final walk; a real end name is.
    expect(labels([leg('WALK', START, END, 3)])).toEqual(['walk: Walk 3 min']);
    expect(labels([leg('WALK', START, STOP_A, 0)])).toEqual(['walk: Walk 1 min to Piața Libertății']);
    expect(tripSteps(undefined)).toEqual([]);
  });

  it('finds the halfway point by distance and colours legs by line', () => {
    expect(pathMidpoint([])).toBeNull();
    expect(pathMidpoint([{ lat: 1, lon: 1 }])).toEqual({ lat: 1, lon: 1 });
    const mid = pathMidpoint([{ lat: 45, lon: 21 }, { lat: 45.001, lon: 21 }, { lat: 45.004, lon: 21 }])!;
    expect(mid.lat).toBeCloseTo(45.002, 4);
    expect(legStrokeColor(leg('WALK', START, END, 1), '#abc')).toBe('#abc');
    expect(legStrokeColor(leg('TRAM', STOP_A, STOP_B, 1, { route: '2' }), '#abc')).toBe(lineColor('2'));
  });
});

describe('ride colours match the live vehicles', () => {
  // The planner names the line "E2"; /transit/routes (and so every vehicle) knows it by the id "77".
  const routes: TransitRoute[] = [{ id: '77', type: 'EXPRESS', name: 'E2', from: null, to: null, color: null }];
  const ride = leg('BUS', STOP_A, STOP_B, 5, { route: 'E2' });

  it('colours the leg, its board / get-off markers and its vehicles alike when the name and id differ', () => {
    expect(lineColor('E2')).not.toBe(lineColor('77')); // otherwise the test proves nothing
    const vehicleColor = lineColor('77');
    expect(legLineColor(ride, routes)).toBe(vehicleColor);
    expect(legStrokeColor(ride, '#abc', routes)).toBe(vehicleColor);
    const steps = tripSteps([ride], null, routes);
    expect(steps.map((st) => st.color)).toEqual([vehicleColor, vehicleColor]);
    // The vehicle badge of that line uses the same colour.
    render(<VehicleBadge vehicle={{ id: 'x', route: '77', routeName: 'E2', type: 'EXPRESS', lat: 0, lon: 0 } as unknown as TransitVehicle} />);
    expect(StyleSheet.flatten(screen.getByLabelText(/E2$/).props.style).backgroundColor).toBe(vehicleColor);
  });

  it('falls back to the leg name before the line list has loaded', () => {
    expect(legLineColor(ride, undefined)).toBe(lineColor('E2'));
  });
});

describe('TripStepMarker', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  const [walk, board, alight] = tripSteps([leg('WALK', START, STOP_A, 4), leg('TRAM', STOP_A, STOP_B, 5, { route: '1' })]);

  it('snapshots its view briefly after appearing, then freezes it (Android)', () => {
    render(<TripStepMarker step={board} />);
    expect(screen.getByTestId('trip-step-board-1').props.tracksViewChanges).toBe(true);
    act(() => jest.advanceTimersByTime(MARKER_TRACK_MS));
    expect(screen.getByTestId('trip-step-board-1').props.tracksViewChanges).toBe(false);
  });

  it('puts the gap below a get-off stop in a wrapper padding, never a margin on the marker root', () => {
    render(
      <>
        <TripStepMarker step={alight} />
        <TripStepMarker step={walk} />
      </>,
    );
    const root = screen.getByTestId('trip-step-alight-1').props.children;
    const rootStyle = StyleSheet.flatten(root.props.style) ?? {};
    expect(rootStyle.paddingTop).toBe(4);
    expect(rootStyle.marginTop).toBeUndefined();
    const pill = StyleSheet.flatten(screen.getByLabelText('Get off at Piața Victoriei').props.style);
    expect(pill.marginTop).toBeUndefined();
    expect(StyleSheet.flatten(screen.getByTestId('trip-step-walk-0').props.children.props.style)).toBeUndefined();
  });
});

describe('LegVehicles', () => {
  /** The ride legs' vehicles drawn by LegVehicles, and their z-order. */
  const zOf = () => screen.getAllByTestId(/^leg-vehicle-marker-/).map((m) => [m.props.testID.replace('leg-vehicle-marker-', ''), m.props.zIndex] as const);

  it('draws the vehicle approaching the boarding stop enlarged while none is selected, the selected one otherwise', async () => {
    const legs = [leg('TRAM', STOP_A, STOP_D, 9, { route: '1', headsign: 'Gara de Nord' })];
    const onSelect = jest.fn();
    const { rerender, client } = renderScreen(<LegVehicles legs={legs} onSelect={onSelect} />);
    await waitFor(() => expect(screen.queryAllByTestId(/^leg-vehicle-marker-/).length).toBeGreaterThan(1));
    const vehicles = ((await mocks.mockRequest('GET', '/transit/vehicles', { route: '1' })) as { vehicles: TransitVehicle[] }).vehicles;
    const [expected] = [...approachingVehicleIds(legs, vehicles, undefined)];
    await waitFor(() => expect(zOf().filter(([, z]) => z === 30).map(([id]) => id)).toEqual([expected]));
    const other = zOf().find(([id]) => id !== expected)![0];
    rerender(
      <QueryClientProvider client={client}>
        <LegVehicles legs={legs} onSelect={onSelect} selectedId={other} />
      </QueryClientProvider>,
    );
    expect(zOf().filter(([, z]) => z === 30).map(([id]) => id)).toEqual([other]);
  });
});

describe('approachingVehicleIds', () => {
  /** A vehicle of a line at a point. */
  const vehicle = (id: string, route: string, lat: number, headsign: string | null = null) =>
    ({ id, route, routeName: route, type: 'TRAM', lat, lon: 21.22, headsign }) as unknown as TransitVehicle;

  it('picks the vehicle of each ride line nearest its boarding stop, preferring the right direction', () => {
    const legs = [leg('WALK', START, STOP_A, 4), leg('TRAM', STOP_A, STOP_D, 9, { route: '1', headsign: 'Gara de Nord' })];
    const vehicles = [vehicle('near-wrong-way', '1', 45.7551, 'Calea Aradului'), vehicle('far-right-way', '1', 45.74, 'Gara de Nord'), vehicle('other-line', '2', 45.755)];
    expect([...approachingVehicleIds(legs, vehicles, undefined)]).toEqual(['far-right-way']);
    expect(approachingVehicleIds([leg('WALK', START, END, 3)], vehicles, undefined).size).toBe(0);
    expect(approachingVehicleIds(legs, [], undefined).size).toBe(0);
  });
});

/** Long-presses the mocked map at a point. */
function longPress(lat: number, lon: number) {
  fireEvent(screen.getByTestId('main-map'), 'longPress', { nativeEvent: { coordinate: { latitude: lat, longitude: lon } } });
}

/** The label of a step marker found by its testID. */
const stepLabel = (testID: string) => String(within(screen.getByTestId(testID)).getByText(/./).props.children);

describe('MapScreen trip guidance', () => {
  afterEach(() => setParams({}));

  it('directions preview: board, get-off and walk markers with the right text', async () => {
    renderScreen(<MapScreen />);
    longPress(45.7275, 21.2355);
    await waitFor(() => expect(screen.getByTestId('trip-step-board-1')).toBeTruthy());
    expect(stepLabel('trip-step-walk-0')).toMatch(/^Walk \d+ min$/);
    expect(stepLabel('trip-step-board-1')).toMatch(/^Board Tram \d+ → .+ · \d\d:\d\d$/);
    expect(stepLabel('trip-step-alight-1')).toMatch(/^Get off at .+/);
    expect(stepLabel('trip-step-walk-2')).toMatch(/^Walk \d+ min to Dropped pin$/);
    expect(screen.getByText(/^Board Tram \d+ →/)).toBeTruthy();
    // Rides are drawn in their line colour, walks dashed.
    const ride = screen.getByTestId('route-line-1');
    expect(ride.props.strokeColor).not.toBe('#FFD60A');
    expect(ride.props.lineDashPattern).toBeUndefined();
    expect(screen.getByTestId('route-line-0').props.lineDashPattern).toEqual([8, 8]);
  });

  it('walking route: a single walk label and no board marker', async () => {
    renderScreen(<MapScreen />);
    longPress(45.7545, 21.2265);
    await waitFor(() => expect(screen.getByTestId('trip-step-walk-0')).toBeTruthy());
    expect(stepLabel('trip-step-walk-0')).toMatch(/^Walk \d+ min to Dropped pin$/);
    expect(screen.queryAllByTestId(/^trip-step-board-/)).toHaveLength(0);
  });

  it('journey mode: the same markers for the legs ahead, naming the destination', async () => {
    setParams(
      routeParams(
        { from: { lat: 45.76, lon: 21.23, name: 'Your location' }, to: { lat: 45.7275, lon: 21.2355, name: 'Shopping City' }, mode: 'TRANSIT', durationMinutes: 20, distanceMeters: 3500, startsFromUser: true },
        true,
      ),
    );
    renderScreen(<MapScreen />);
    await waitFor(() => expect(screen.getByTestId('trip-step-board-1')).toBeTruthy());
    expect(stepLabel('trip-step-board-1')).toMatch(/^Board Tram \d+ →/);
    expect(stepLabel('trip-step-alight-1')).toMatch(/^Get off at /);
    expect(stepLabel('trip-step-walk-2')).toMatch(/^Walk \d+ min to Shopping City$/);
  });

  it('journey mode: once the first walk is done its marker goes, the ride markers stay', async () => {
    setParams(
      routeParams(
        { from: { lat: 45.76, lon: 21.23, name: 'Your location' }, to: { lat: 45.7275, lon: 21.2355, name: 'Shopping City' }, mode: 'TRANSIT', durationMinutes: 20, distanceMeters: 3500, startsFromUser: true },
        true,
      ),
    );
    renderScreen(<MapScreen />);
    await waitFor(() => expect(screen.getByTestId('trip-step-walk-0')).toBeTruthy());
    const plan = (await mocks.mockRequest('GET', '/routes/plan', { from: '45.76000,21.23000', to: '45.72750,21.23550', mode: 'TRANSIT' })) as RoutePlan;
    const stop = plan.legs[0].to!;
    await act(async () => (globalThis as unknown as { __moveTo: (a: number, b: number) => void }).__moveTo(stop.lat, stop.lon));
    await waitFor(() => expect(screen.queryByTestId('trip-step-walk-0')).toBeNull());
    expect(screen.getByTestId('trip-step-board-1')).toBeTruthy();
    expect(screen.getByTestId('trip-step-alight-1')).toBeTruthy();
    expect(screen.getByTestId('trip-step-walk-2')).toBeTruthy();
  });
});
