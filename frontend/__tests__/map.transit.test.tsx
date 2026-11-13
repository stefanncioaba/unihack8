// Map transit layer (PLAN 14.4): the mock /transit routes, stops and live vehicles of a line, and the stop panel.
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react-native';

import MapScreen from '@/app/(tabs)/map';
import { arrivalLabel } from '@/features/transit/StopPanel';
import { mockRequest } from '@test/mocks';
import { LINE_STOPS, MOCK_STOPS } from '@test/mocks/transitSeed';

import { renderScreen } from './testUtils';

const call = (path: string, query: Record<string, unknown> = {}) => mockRequest('GET', path, query) as Promise<any>;
const stopMarkers = () => screen.queryAllByTestId(/^stop-marker-/);
const vehicleMarkers = () => screen.queryAllByTestId(/^vehicle-marker-/);

/** Moves the mocked map to a region and waits for the debounce + reload. */
async function moveTo(latitudeDelta: number) {
  await act(async () => {
    fireEvent(screen.getByTestId('main-map'), 'regionChangeComplete', { latitude: 45.752, longitude: 21.225, latitudeDelta, longitudeDelta: latitudeDelta });
    await new Promise((r) => setTimeout(r, 400));
  });
}

describe('mock /transit endpoints', () => {
  it('lists lines trams first and stops inside a bbox', async () => {
    const routes = await call('/transit/routes');
    expect(routes[0]).toMatchObject({ id: '1', type: 'TRAM', color: '#e3a900' });
    const all = await call('/transit/stops');
    expect(all).toHaveLength(MOCK_STOPS.length);
    const some = await call('/transit/stops', { bbox: '21.22,45.75,21.235,45.76' });
    expect(some.length).toBeGreaterThan(0);
    expect(some.length).toBeLessThan(all.length);
    expect(some.every((s: any) => s.lon >= 21.22 && s.lon <= 21.235 && s.lat >= 45.75 && s.lat <= 45.76)).toBe(true);
    await expect(call('/transit/stops', { bbox: 'x' })).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
  });

  it('places vehicles of a line between its stops, and none for a line that is not running', async () => {
    const v = await call('/transit/vehicles', { route: '1' });
    expect(v).toMatchObject({ route: '1', stale: false });
    expect(v.vehicles).toHaveLength(2);
    const lineStops = MOCK_STOPS.filter((s) => LINE_STOPS['1'].includes(s.id));
    const [minLat, maxLat] = [Math.min(...lineStops.map((s) => s.lat)), Math.max(...lineStops.map((s) => s.lat))];
    expect(v.vehicles.every((x: any) => x.lat >= minLat - 1e-9 && x.lat <= maxLat + 1e-9)).toBe(true);
    expect((await call('/transit/vehicles', { route: 'E4' })).vehicles).toEqual([]);
    await expect(call('/transit/vehicles', { route: '999' })).rejects.toMatchObject({ status: 404 });
  });

  it('answers arrivals soonest first and last departures for every line at the stop', async () => {
    const a = await call('/transit/stops/5/arrivals');
    expect(a.stopName).toBe('Piața Libertății');
    const minutes = a.arrivals.map((x: any) => x.minutes);
    expect([...minutes].sort((x, y) => x - y)).toEqual(minutes);
    expect(a.arrivals.some((x: any) => x.live)).toBe(true);
    const last = await call('/transit/last-departures', { stopId: '5' });
    expect(last.source).toBe('TIMETABLE');
    expect(last.departures.map((d: any) => d.route).sort()).toEqual(['1', '14', '8']);
    await expect(call('/transit/stops/nope/arrivals')).rejects.toMatchObject({ status: 404, code: 'NOT_FOUND' });
  });
});

describe('arrivalLabel', () => {
  it('says "now" for due vehicles and minutes otherwise', () => {
    expect(arrivalLabel(0)).toBe('now');
    expect(arrivalLabel(-1)).toBe('now');
    expect(arrivalLabel(4)).toBe('4 min');
  });
});

describe('MapScreen transit layer', () => {
  it('shows no stops until Transit is switched on, then the stops of the visible area', async () => {
    renderScreen(<MapScreen />);
    await moveTo(0.02);
    expect(stopMarkers()).toHaveLength(0);
    fireEvent.press(screen.getByTestId('chip-transit'));
    await waitFor(() => expect(stopMarkers().length).toBeGreaterThan(3));
    fireEvent.press(screen.getByTestId('chip-transit'));
    await waitFor(() => expect(stopMarkers()).toHaveLength(0));
  });

  it('asks to zoom in when the view is too wide for stops', async () => {
    renderScreen(<MapScreen />);
    await moveTo(0.2);
    fireEvent.press(screen.getByTestId('chip-transit'));
    expect(await screen.findByTestId('stops-hint')).toBeTruthy();
    expect(stopMarkers()).toHaveLength(0);
  });

  it('shows the live vehicles of a chosen line and only the stops it serves', async () => {
    renderScreen(<MapScreen />);
    await moveTo(0.02);
    fireEvent.press(screen.getByTestId('chip-transit'));
    fireEvent.press(await screen.findByTestId('chip-line-1'));
    await waitFor(() => expect(vehicleMarkers()).toHaveLength(2));
    const ids = stopMarkers().map((m) => m.props.testID.replace('stop-marker-', ''));
    expect(ids.length).toBeGreaterThan(0);
    expect(ids.every((id) => LINE_STOPS['1'].includes(id))).toBe(true);

    fireEvent.press(screen.getByTestId('chip-line-1')); // tap again = no line
    await waitFor(() => expect(vehicleMarkers()).toHaveLength(0));
  });

  it('says when a line has no vehicles out', async () => {
    renderScreen(<MapScreen />);
    await moveTo(0.02);
    fireEvent.press(screen.getByTestId('chip-transit'));
    fireEvent.press(await screen.findByTestId('chip-line-E4'));
    expect(await screen.findByText('No vehicles on line E4 right now')).toBeTruthy();
  });

  it('opens a stop panel with next arrivals and last departures', async () => {
    renderScreen(<MapScreen />);
    await moveTo(0.02);
    fireEvent.press(screen.getByTestId('chip-transit'));
    fireEvent.press(await screen.findByTestId('stop-marker-5'));
    const panel = within(await screen.findByTestId('stop-panel'));
    expect(await panel.findByText('Piața Libertății')).toBeTruthy();
    await waitFor(() => expect(panel.getAllByTestId('arrival-row').length).toBeGreaterThan(0));
    await waitFor(() => expect(panel.getAllByTestId('last-departure-row')).toHaveLength(3));
    expect(panel.getByText('Next arrivals')).toBeTruthy();
    expect(panel.getByText('Last departures today')).toBeTruthy();
  });
});
