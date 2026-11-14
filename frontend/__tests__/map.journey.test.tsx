// Journey mode (PLAN 18.5–18.7): the journey maths with plain positions, then the Map tab opened by "Go" with mocked
// GPS updates — current step, step advance, off-route re-plan, arrival, End, permission and the route preview.
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import * as Location from 'expo-location';

import type { RouteLeg, RoutePlan } from '@/api/types.routing';
import MapScreen from '@/app/(tabs)/map';
import { routeParams } from '@/features/journey/navigation';
import { journeyProgress, nearestOnLine, stepText } from '@/features/journey/progress';
import { encodePolyline } from '@/lib/polyline';
import * as mocks from '@test/mocks';

import { renderScreen, setParams } from './testUtils';

/** Moves the mocked phone. */
async function moveTo(lat: number, lon: number) {
  await act(async () => (globalThis as unknown as { __moveTo: (a: number, b: number) => void }).__moveTo(lat, lon));
}

/** A leg along a straight line. */
function leg(mode: RouteLeg['mode'], from: [number, number], to: [number, number], minutes: number, extra: Partial<RouteLeg> = {}): RouteLeg {
  return {
    mode,
    route: null,
    headsign: null,
    from: { name: 'A', lat: from[0], lon: from[1] },
    to: { name: 'B', lat: to[0], lon: to[1] },
    startsAt: null,
    endsAt: null,
    durationMinutes: minutes,
    polyline: encodePolyline([{ lat: from[0], lon: from[1] }, { lat: to[0], lon: to[1] }]),
    ...extra,
  };
}

// Walk 0.005° north (~556 m), ride 0.02° north (~2.2 km), walk 0.003° east.
const START: [number, number] = [45.75, 21.22];
const STOP_A: [number, number] = [45.755, 21.22];
const STOP_B: [number, number] = [45.775, 21.22];
const END: [number, number] = [45.775, 21.223];
const PLAN: RoutePlan = {
  mode: 'TRANSIT',
  durationMinutes: 20,
  distanceMeters: 3000,
  startsAt: '',
  endsAt: '',
  fallback: false,
  legs: [
    leg('WALK', START, STOP_A, 7, { to: { name: 'Piața Libertății', lat: STOP_A[0], lon: STOP_A[1] } }),
    leg('TRAM', STOP_A, STOP_B, 8, { route: '1', headsign: 'Gara de Nord', to: { name: 'Gara de Nord', lat: STOP_B[0], lon: STOP_B[1] } }),
    leg('WALK', STOP_B, END, 5),
  ],
};
const DEST = { lat: END[0], lon: END[1] };

describe('journeyProgress', () => {
  it('starts on the first step with the whole route left', () => {
    const p = journeyProgress(PLAN, { lat: START[0], lon: START[1] }, 0, DEST);
    expect(p).toMatchObject({ stepIndex: 0, arrived: false });
    expect(p.offRouteMeters).toBeLessThan(1);
    expect(p.remainingMinutes).toBe(20);
    expect(p.remainingMeters).toBeGreaterThan(2900);
  });

  it('moves to the ride at the stop and halfway along it counts half its time', () => {
    expect(journeyProgress(PLAN, { lat: STOP_A[0], lon: STOP_A[1] }, 0, DEST).stepIndex).toBe(1);
    const half = journeyProgress(PLAN, { lat: 45.765, lon: 21.22 }, 1, DEST);
    expect(half.stepIndex).toBe(1);
    expect(half.remainingMinutes).toBe(9); // 4 of the ride + 5 walking
  });

  it('never goes back to an earlier step', () => {
    expect(journeyProgress(PLAN, { lat: START[0], lon: START[1] }, 2, DEST).stepIndex).toBe(2);
  });

  it('measures how far off the route the user is', () => {
    // ~390 m west of the first walk.
    const p = journeyProgress(PLAN, { lat: 45.752, lon: 21.215 }, 0, DEST);
    expect(p.offRouteMeters).toBeGreaterThan(300);
    expect(nearestOnLine({ lat: 45.7525, lon: 21.22 }, [{ lat: START[0], lon: START[1] }, { lat: STOP_A[0], lon: STOP_A[1] }]).meters).toBeLessThan(1);
  });

  it('has arrived within about 30 m of the destination', () => {
    expect(journeyProgress(PLAN, { lat: END[0] + 0.0002, lon: END[1] }, 2, DEST).arrived).toBe(true); // ~22 m
    expect(journeyProgress(PLAN, { lat: END[0] + 0.0004, lon: END[1] }, 2, DEST).arrived).toBe(false); // ~44 m
  });

  it('writes the step instructions', () => {
    expect(stepText(PLAN.legs[0], false, 'Scârț')).toBe('Walk to stop Piața Libertății');
    expect(stepText(PLAN.legs[1], false, 'Scârț')).toBe('Take tram 1 towards Gara de Nord, get off at Gara de Nord');
    expect(stepText(PLAN.legs[2], true, 'Scârț')).toBe('Walk to Scârț');
    expect(stepText(PLAN.legs[2], true, null)).toBe('Walk to your destination');
  });
});

// The mocked GPS starts at 45.76, 21.23; Shopping City is ~3.5 km south, so the mock plans walk → tram → walk.
const GPS = { lat: 45.76, lon: 21.23 };
const SHOPPING_CITY = { lat: 45.7275, lon: 21.2355 };

/** Opens the Map tab as the "Go" button does. */
function openJourney(answeredFrom = GPS, mode: 'WALK' | 'TRANSIT' = 'TRANSIT') {
  setParams(
    routeParams(
      { from: { ...answeredFrom, name: 'Your location' }, to: { ...SHOPPING_CITY, name: 'Shopping City' }, mode, durationMinutes: 20, distanceMeters: 3500, startsFromUser: true, leaveNow: null },
      true,
    ),
  );
  return renderScreen(<MapScreen />);
}

/** The /routes/plan requests made so far. */
function planCalls(spy: jest.SpyInstance) {
  return spy.mock.calls.filter((c) => c[0] === 'GET' && c[1] === '/routes/plan');
}

afterEach(() => {
  jest.restoreAllMocks();
  (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });
});

describe('MapScreen journey mode', () => {
  it('"Go" plans from the live GPS position and shows the first step, time left and End', async () => {
    const spy = jest.spyOn(mocks, 'mockRequest');
    openJourney();
    const panel = within(await screen.findByTestId('journey-panel'));
    expect(await panel.findByText(/^Walk to stop /)).toBeTruthy();
    expect(panel.getByText(/^Then: Take tram /)).toBeTruthy();
    expect(panel.getByTestId('journey-remaining').props.children.join('')).toMatch(/^\d+ min · .+ left$/);
    expect(panel.getByRole('button', { name: 'End' })).toBeTruthy();
    expect(planCalls(spy)[0][2]).toMatchObject({ from: '45.76000,21.23000', to: '45.72750,21.23550', mode: 'TRANSIT' });
    await waitFor(() => expect(screen.getAllByTestId(/^journey-line-/)).toHaveLength(3));
    expect(screen.queryByTestId('map-panel')).toBeNull();
  });

  it('moves to the next step when the user reaches the stop', async () => {
    openJourney();
    await screen.findByText(/^Walk to stop /);
    const plan = (await mocks.mockRequest('GET', '/routes/plan', { from: '45.76000,21.23000', to: '45.72750,21.23550', mode: 'TRANSIT' })) as RoutePlan;
    const stop = plan.legs[0].to!;
    await moveTo(stop.lat, stop.lon);
    expect(await screen.findByText(/^Take tram \d+ towards .+, get off at /)).toBeTruthy();
    expect(screen.getByText('Then: Walk to Shopping City')).toBeTruthy();
  });

  it('re-plans from the new position when the user is off the route', async () => {
    const spy = jest.spyOn(mocks, 'mockRequest');
    openJourney();
    await screen.findByText(/^Walk to stop /);
    expect(planCalls(spy)).toHaveLength(1);
    await moveTo(45.765, 21.2); // ~2.4 km west of the route
    await waitFor(() => expect(planCalls(spy)).toHaveLength(2));
    expect(planCalls(spy)[1][2]).toMatchObject({ from: '45.76500,21.20000' });
  });

  it('says "You have arrived" near the destination, and Done ends the journey', async () => {
    openJourney();
    await screen.findByText(/^Walk to stop /);
    await moveTo(SHOPPING_CITY.lat + 0.0001, SHOPPING_CITY.lon);
    expect(await screen.findByText('You have arrived')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Done' }));
    expect(screen.queryByTestId('journey-panel')).toBeNull();
  });

  it('End stops following the user', async () => {
    openJourney();
    await screen.findByText(/^Walk to stop /);
    fireEvent.press(screen.getByRole('button', { name: 'End' }));
    expect(screen.queryByTestId('journey-panel')).toBeNull();
    expect(screen.queryByTestId('journey-destination')).toBeNull();
  });

  it('says the route starts from here when the user moved more than 200 m since the answer', async () => {
    openJourney({ lat: 45.75, lon: 21.23 }); // the AI answered ~1.1 km from where the phone is now
    expect(await screen.findByTestId('journey-moved')).toBeTruthy();
  });

  it('does not start without location permission', async () => {
    (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'denied' });
    const spy = jest.spyOn(mocks, 'mockRequest');
    openJourney();
    expect(await screen.findByTestId('journey-permission')).toBeTruthy();
    expect(planCalls(spy)).toHaveLength(0);
    (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });
    fireEvent.press(screen.getByRole('button', { name: 'Allow location' }));
    expect(await screen.findByText(/^Walk to stop /)).toBeTruthy();
  });

  it('shows the usual error with retry when the route cannot be planned', async () => {
    const real = mocks.mockRequest;
    let failed = false;
    jest.spyOn(mocks, 'mockRequest').mockImplementation((method, path, query, body) => {
      if (path === '/routes/plan' && !failed) {
        failed = true;
        return Promise.reject(new Error('Network request failed'));
      }
      return real(method, path, query, body);
    });
    openJourney();
    const panel = within(await screen.findByTestId('journey-panel'));
    fireEvent.press(await panel.findByRole('button', { name: 'Try again' }));
    expect(await panel.findByText(/^Walk to stop /)).toBeTruthy();
  });
});

describe('MapScreen route preview', () => {
  it('"Show route on map" previews a route from another place, with no journey', async () => {
    const spy = jest.spyOn(mocks, 'mockRequest');
    setParams(
      routeParams(
        { from: { lat: 45.7472, lon: 21.231, name: 'West University' }, to: { ...SHOPPING_CITY, name: 'Shopping City' }, mode: 'WALK', durationMinutes: 30, distanceMeters: 3000, startsFromUser: false, leaveNow: null },
        false,
      ),
    );
    renderScreen(<MapScreen />);
    const panel = within(await screen.findByTestId('directions-panel'));
    expect(panel.getByText('Directions to Shopping City')).toBeTruthy();
    expect(panel.getByTestId('directions-origin').props.children.join('')).toBe('From West University');
    expect(screen.getByTestId('origin-marker')).toBeTruthy();
    expect(screen.queryByTestId('journey-panel')).toBeNull();
    await waitFor(() => expect(panel.getAllByTestId('route-leg')).toHaveLength(1));
    expect(planCalls(spy).some((c) => c[2].from === '45.74720,21.23100' && c[2].mode === 'WALK')).toBe(true);
  });
});
