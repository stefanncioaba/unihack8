// AI tab. Foundation only: the chat itself is PLAN task 15, so this shows the page frame with a clear message.
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';

import { Screen } from '@/ui/Screen';
import { Text } from '@/ui/Text';
import { colors } from '@/ui/theme';

/** Abstract cyan/orange light motif for the page's breathing zone. */
function Motif() {
  return (
    <Svg width={160} height={160} viewBox="0 0 160 160">
      <Defs>
        <LinearGradient id="aiRing" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={colors.teal} />
          <Stop offset="1" stopColor={colors.orange} />
        </LinearGradient>
      </Defs>
      <Circle cx="80" cy="80" r="62" stroke="url(#aiRing)" strokeWidth="2" fill="none" opacity={0.85} />
      <Circle cx="80" cy="80" r="40" stroke={colors.teal} strokeWidth="1" fill="none" opacity={0.4} />
      <Circle cx="80" cy="80" r="18" fill="url(#aiRing)" opacity={0.9} />
    </Svg>
  );
}

/** Placeholder page until the chat is built. */
export default function AiScreen() {
  return (
    <Screen glow="warm">
      <View style={styles.zone}>
        <Motif />
      </View>
      <Text variant="title" style={styles.center} accessibilityRole="header">
        Ask about the city
      </Text>
      <Text tone="muted" style={[styles.center, { marginTop: 8 }]}>
        Soon you will be able to ask where to eat, what to do this weekend and how to get there. This page is coming next.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  zone: { alignItems: 'center', paddingTop: 56, paddingBottom: 24 },
  center: { textAlign: 'center' },
});
