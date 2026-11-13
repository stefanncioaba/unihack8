// Stack for everything under /users (search, public profile).
import { Stack } from 'expo-router';

import { colors } from '@/ui/theme';

/** Plain stack; each screen draws its own header. */
export default function UsersLayout() {
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />;
}
