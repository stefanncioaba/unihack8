// Stack for the signed-out screens.
import { Stack } from 'expo-router';

import { colors } from '@/ui/theme';

/** Sign-in and sign-up, without headers. */
export default function AuthLayout() {
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />;
}
