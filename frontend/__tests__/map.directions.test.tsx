// Map directions (PLAN 14.5): the mock /routes/plan, the directions panel (walk vs walk + transit) and the drawn route.
import { fireEvent, screen, waitFor, within } from '@testing-library/react-native';

import type { RouteLeg } from '@/api/types.routing';
import MapScreen from '@/app/(tabs)/map';
import { legTitle } from '@/features/directions/DirectionsPanel';
import { decodePolyline } from '@/lib/polyline';
import { mockRequest } from '@test/mocks';
import { placeId } from '@test/mocks/placesSeed';

import { renderScreen } from './testUtils';

const plan = (query: Record<string, unknown>) => mockRequest('GET', '/routes/plan', query) as Promise<any>;
const CENTRE = '45.7537,21.2257';
const FAR = '45.7275,21.2355'; // Shopping City, ~3 km south
const NEAR = '45.7545,21.2265'; // ~100 m away

/** Long-presses the mocked map at a point. */
function longPress(lat: number, lon: number) {
  fireEvent(screen.getByTestId('main-map'), 'longPress', { nativeEvent: { coordinate: { latitude: lat, longitude: lon } } });
}

describe('mock /routes/plan', () => {
  it('answers a walking route as one leg with a decodable polyline', async () => {
    const p = await plan({ from: CENTRE, to: FAR, mode: 'WALK' });
    expect(p).toMatchObject({ mode: 'WALK', fallback: false });
    expect(p.legs).toHaveLength(1);
    expect(p.legs[0]).toMatchObject({ mode: 'WALK', route: null, headsign: null });
    expect(decodePolyline(p.legs[0].polyline)).toEqual([
      { lat: 45.7537, lon: 21.2257 },
      { lat: 45.7275, lon: 21.2355 },
    ]);
    expect(p.durationMinutes).toBeGreaterThan(30);
  });

  it('rides public transport for a longer trip and is faster than walking', async () => {
    const walk = await plan({ from: CENTRE, to: FAR, mode: 'WALK' });
    const transit = await plan({ from: CENTRE, to: FAR, mode: 'TRANSIT' });
    expect(transit.mode).toBe('TRANSIT');
    expect(transit.legs.map((l: any) => l.mode)).toEqual(['WALK', 'TRAM', 'WALK']);
    expect(transit.legs[1].route).toBeTruthy();
    expect(transit.durationMinutes).toBeLessThan(walk.durationMinutes);
    expect(Date.parse(transit.endsAt) - Date.parse(transit.startsAt)).toBe(transit.durationMinutes * 60_000);
  });

  it('answers the walking route (mode WALK) when transit does not help', async () => {
    const p = await plan({ from: CENTRE, to: NEAR, mode: 'TRANSIT' });
    expect(p.mode).toBe('WALK');
  });

  it('answers the documented errors', async () => {
    await expect(plan({ from: 'x', to: FAR, mode: 'WALK' })).rejects.toMatchObject({ status: 400, code: 'VALIDATION_FAILED' });
    await expect(plan({ from: CENTRE, to: FAR, mode: 'BIKE' })).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
    await expect(plan({ from: CENTRE, to: '44.43,26.10', mode: 'TRANSIT' })).rejects.toMatchObject({ status: 503, code: 'SOURCE_UNAVAILABLE' });
    expect((await plan({ from: CENTRE, to: '44.43,26.10', mode: 'WALK' })).mode).toBe('WALK');
  });
});

describe('legTitle', () => {
  const base = { from: { name: 'A', lat: 0, lon: 0 }, to: { name: 'B', lat: 0, lon: 0 }, startsAt: '', endsAt: '', durationMinutes: 1, polyline: '' };
  it('names walking and riding legs', () => {
    expect(legTitle({ ...base, mode: 'WALK', route: null, headsign: null } as RouteLeg)).toBe('Walk to B');
    expect(legTitle({ ...base, mode: 'TRAM', route: '1', headsign: 'Gara de Nord' } as RouteLeg)).toBe('Tram 1 → Gara de Nord');
    expect(legTitle({ ...base, mode: 'TROLLEYBUS', route: '14', headsign: null } as RouteLeg)).toBe('Trolleybus 14 → B');
  });
});

describe('MapScreen directions', () => {
  it('long-press opens directions with walk + transit selected, steps listed and the route drawn', async () => {
    renderScreen(<MapScreen />);
    longPress(45.7275, 21.2355);
    const panel = within(await screen.findByTestId('directions-panel'));
    expect(panel.getByText('Directions to Dropped pin')).toBeTruthy();
    await waitFor(() => expect(panel.getAllByTestId('route-leg')).toHaveLength(3));
    expect(panel.getByText(/^Tram \d+ →/)).toBeTruthy();
    expect(panel.getByText(/^Arrive \d\d:\d\d · /)).toBeTruthy();
    expect(screen.getByTestId('destination-marker')).toBeTruthy();
    await waitFor(() => expect(screen.getAllByTestId(/^route-line-/)).toHaveLength(3));
  });

  it('switches to the walking route and shows both times on the tabs', async () => {
    renderScreen(<MapScreen />);
    longPress(45.7275, 21.2355);
    const panel = within(await screen.findByTestId('directions-panel'));
    await waitFor(() => expect(panel.getAllByTestId('route-leg')).toHaveLength(3));
    expect(panel.getAllByText(/^\d+ min$/).length).toBeGreaterThanOrEqual(2);
    fireEvent.press(panel.getByRole('tab', { name: 'Walk' }));
    await waitFor(() => expect(panel.getAllByTestId('route-leg')).toHaveLength(1));
    await waitFor(() => expect(screen.getAllByTestId(/^route-line-/)).toHaveLength(1));
  });

  it('explains when walking is the best "transit" route for a short trip', async () => {
    renderScreen(<MapScreen />);
    longPress(45.7545, 21.2265);
    expect(await screen.findByText(/No public transport is faster right now/)).toBeTruthy();
  });

  it('shows an error with retry when the planner is unavailable, while walking still works', async () => {
    renderScreen(<MapScreen />);
    longPress(44.43, 26.1);
    const panel = within(await screen.findByTestId('directions-panel'));
    expect(await panel.findByRole('button', { name: /try again/i })).toBeTruthy();
    expect(panel.getByText('Unavailable')).toBeTruthy();
    fireEvent.press(panel.getByRole('tab', { name: 'Walk' }));
    await waitFor(() => expect(panel.getAllByTestId('route-leg')).toHaveLength(1));
  });

  it('opens from a place panel "Directions" button with the place name', async () => {
    renderScreen(<MapScreen />);
    fireEvent(screen.getByTestId('main-map'), 'regionChangeComplete', { latitude: 45.7537, longitude: 21.2257, latitudeDelta: 0.01, longitudeDelta: 0.01 });
    fireEvent.press(await screen.findByTestId(`place-marker-${placeId(0)}`));
    const place = within(await screen.findByTestId('place-panel'));
    fireEvent.press(await place.findByRole('button', { name: 'Directions' }));
    expect(await screen.findByText('Directions to Pizzeria Napoli')).toBeTruthy();
    expect(screen.queryByTestId('place-panel')).toBeNull();
  });
});
