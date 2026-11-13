// Location permission and the "current position" hook.
import * as Location from 'expo-location';
import { render, screen, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';

import { LocationProvider, useCurrentPosition } from '@/features/location/LocationProvider';

const permission = Location.requestForegroundPermissionsAsync as jest.Mock;
const position = Location.getCurrentPositionAsync as jest.Mock;

/** Prints the hook's state so tests can read it. */
function Probe() {
  const { position: p, status, isFallback } = useCurrentPosition();
  return <Text>{`${status} ${p.lat.toFixed(4)},${p.lon.toFixed(4)} ${isFallback ? 'fallback' : 'real'}`}</Text>;
}

describe('useCurrentPosition', () => {
  it('uses the phone position when permission is granted', async () => {
    permission.mockResolvedValue({ status: 'granted' });
    position.mockResolvedValue({ coords: { latitude: 45.76, longitude: 21.23 } });
    render(
      <LocationProvider>
        <Probe />
      </LocationProvider>,
    );
    expect(await screen.findByText('granted 45.7600,21.2300 real')).toBeTruthy();
  });

  it('falls back to Piața Victoriei when permission is denied', async () => {
    permission.mockResolvedValue({ status: 'denied' });
    render(
      <LocationProvider>
        <Probe />
      </LocationProvider>,
    );
    expect(await screen.findByText('denied 45.7537,21.2257 fallback')).toBeTruthy();
    expect(position).not.toHaveBeenCalled();
  });

  it('falls back when the position cannot be read', async () => {
    permission.mockResolvedValue({ status: 'granted' });
    position.mockRejectedValue(new Error('GPS off'));
    render(
      <LocationProvider>
        <Probe />
      </LocationProvider>,
    );
    expect(await screen.findByText('error 45.7537,21.2257 fallback')).toBeTruthy();
  });

  it('does not ask for permission until enabled', async () => {
    permission.mockResolvedValue({ status: 'granted' });
    const view = render(
      <LocationProvider enabled={false}>
        <Probe />
      </LocationProvider>,
    );
    expect(screen.getByText(/^loading/)).toBeTruthy();
    expect(permission).not.toHaveBeenCalled();
    view.rerender(
      <LocationProvider enabled>
        <Probe />
      </LocationProvider>,
    );
    await waitFor(() => expect(permission).toHaveBeenCalledTimes(1));
  });

  it('works without a provider (default position)', () => {
    render(<Probe />);
    expect(screen.getByText('denied 45.7537,21.2257 fallback')).toBeTruthy();
  });
});
