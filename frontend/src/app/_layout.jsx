import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

// Defines the native navigation stack for the JavaScript app.
export default function RootLayout() {
  return (
    <>
      <StatusBar style="dark" />
      <Stack>
        <Stack.Screen name="index" options={{ title: 'Discover Timișoara' }} />
      </Stack>
    </>
  );
}
