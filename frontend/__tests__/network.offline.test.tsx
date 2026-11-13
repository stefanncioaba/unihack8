// Offline handling (PLAN 17.4): the banner follows TanStack Query's online state, which follows NetInfo.
import NetInfo from '@react-native-community/netinfo';
import { onlineManager } from '@tanstack/react-query';
import { act, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { isOnline, startNetworkSync } from '@/lib/network';
import { OfflineBanner } from '@/ui/OfflineBanner';

afterEach(() => act(() => onlineManager.setOnline(true)));

describe('isOnline', () => {
  it('treats unknown reachability as online and any explicit "false" as offline', () => {
    expect(isOnline({ isConnected: true, isInternetReachable: null })).toBe(true);
    expect(isOnline({ isConnected: true, isInternetReachable: true })).toBe(true);
    expect(isOnline({ isConnected: false, isInternetReachable: null })).toBe(false);
    expect(isOnline({ isConnected: true, isInternetReachable: false })).toBe(false);
  });
});

describe('OfflineBanner', () => {
  it('appears while offline and disappears when the connection is back', () => {
    render(
      <SafeAreaProvider>
        <OfflineBanner />
      </SafeAreaProvider>,
    );
    expect(screen.queryByTestId('offline-banner')).toBeNull();
    act(() => onlineManager.setOnline(false));
    expect(screen.getByText(/You’re offline/)).toBeTruthy();
    act(() => onlineManager.setOnline(true));
    expect(screen.queryByTestId('offline-banner')).toBeNull();
  });
});

describe('startNetworkSync', () => {
  it('subscribes TanStack Query to NetInfo once', () => {
    const spy = jest.spyOn(NetInfo, 'addEventListener');
    startNetworkSync();
    startNetworkSync();
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
