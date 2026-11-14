// Stack for the Timișoara news screen (PLAN 27).
import { Stack } from 'expo-router';

import { colors } from '@/ui/theme';

/** Plain stack; the screen draws its own header. */
export default function NewsLayout() {
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />;
}
