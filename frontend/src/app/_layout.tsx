// Root layout: providers + the auth gate. Signed-out users can only reach the (auth) screens.
import { QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider, useAuth } from '@/features/auth/AuthProvider';
import { LocationProvider } from '@/features/location/LocationProvider';
import { startNetworkSync } from '@/lib/network';
import { queryClient } from '@/lib/queryClient';
import { OfflineBanner } from '@/ui/OfflineBanner';
import { LoadingState } from '@/ui/States';
import { Screen } from '@/ui/Screen';
import { colors } from '@/ui/theme';

/** Shows the right set of screens for the current session. */
function Gate() {
  const { session, loading } = useAuth();
  const signedIn = !!session;

  // Never show one user's cached data to the next person who signs in on this phone.
  useEffect(() => {
    if (!loading && !signedIn) queryClient.clear();
  }, [loading, signedIn]);

  if (loading) {
    return (
      <Screen glow="none">
        <LoadingState label="Starting…" />
      </Screen>
    );
  }

  return (
    <LocationProvider enabled={signedIn}>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
        <Stack.Protected guard={signedIn}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="events" />
          <Stack.Screen name="users" />
          <Stack.Screen name="pulse" />
          <Stack.Screen name="help" />
          <Stack.Screen name="news" />
        </Stack.Protected>
        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="(auth)" />
        </Stack.Protected>
      </Stack>
    </LocationProvider>
  );
}

// Queries pause while offline and refetch when the connection returns (PLAN 17.4).
startNetworkSync();

/** App entry: query cache, auth and safe-area providers around the gate, plus the offline banner. */
export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <StatusBar style="light" />
          <OfflineBanner />
          <Gate />
        </AuthProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
