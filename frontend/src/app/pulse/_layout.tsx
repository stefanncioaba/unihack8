// Stack for the Neighbourhood Pulse screen.
import { Stack } from 'expo-router';

import { colors } from '@/ui/theme';

/** Plain stack; the screen draws its own header. */
export default function PulseLayout() {
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />;
}
