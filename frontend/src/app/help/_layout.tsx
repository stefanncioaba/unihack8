// Stack for everything under /help (board, ask for help, request page, helper code, scanner).
import { Stack } from 'expo-router';

import { colors } from '@/ui/theme';

/** Plain stack; each screen draws its own header. */
export default function HelpLayout() {
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />;
}
