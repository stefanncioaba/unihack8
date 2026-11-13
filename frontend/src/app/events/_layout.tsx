// Stack for everything under /events (list, details, create, ticket, scanner).
import { Stack } from 'expo-router';

import { colors } from '@/ui/theme';

/** Plain stack; each screen draws its own header. */
export default function EventsLayout() {
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />;
}
