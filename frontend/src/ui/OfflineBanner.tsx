// Thin banner at the top of every screen while the phone is offline (PLAN 17.4). Cached data stays visible;
// TanStack Query refetches it automatically once the connection is back (see lib/network.ts).
import { onlineManager } from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from './Icon';
import { Text } from './Text';
import { colors } from './theme';

/** Subscribes to TanStack Query's online state. */
function useOnline(): boolean {
  return useSyncExternalStore(onlineManager.subscribe.bind(onlineManager), () => onlineManager.isOnline());
}

/** Shows "You're offline" above the app; renders nothing when online. */
export function OfflineBanner() {
  const online = useOnline();
  const insets = useSafeAreaInsets();
  if (online) return null;
  return (
    <View style={[styles.banner, { paddingTop: insets.top + 6 }]} testID="offline-banner" accessibilityRole="alert">
      <Icon name="cloud-offline-outline" size={14} color={colors.text} />
      <Text variant="caption" style={styles.text}>
        You’re offline — showing saved data. It refreshes when you’re back online.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingBottom: 6,
    backgroundColor: 'rgba(255,90,106,0.92)',
  },
  text: { color: colors.text, flexShrink: 1, textAlign: 'center' },
});
