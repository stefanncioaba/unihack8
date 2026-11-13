// Abstract cyan/orange light motif for the empty chat's breathing zone (no logo, no mascot).
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';

import { colors } from '@/ui/theme';

/** Concentric rings with a soft gradient core. */
export function ChatMotif({ size = 140 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 160 160" accessibilityElementsHidden>
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
