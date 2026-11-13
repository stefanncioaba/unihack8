// Connectivity (PLAN 17.4): TanStack Query follows the phone's network state, so queries pause while offline,
// keep showing their cached data, and refetch by themselves when the connection comes back.
import NetInfo, { type NetInfoState } from '@react-native-community/netinfo';
import { onlineManager } from '@tanstack/react-query';

/** True when the phone has a connection (an unknown "internet reachable" counts as online). */
export function isOnline(state: Pick<NetInfoState, 'isConnected' | 'isInternetReachable'>): boolean {
  return state.isConnected !== false && state.isInternetReachable !== false;
}

let started = false;

/** Connects NetInfo to TanStack Query's online manager once per app start. */
export function startNetworkSync(): void {
  if (started) return;
  started = true;
  onlineManager.setEventListener((setOnline) => NetInfo.addEventListener((state) => setOnline(isOnline(state))));
}
