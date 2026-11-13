// The one default profile picture used for every user (no custom pictures yet, see PLAN 2.1).
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import { colors } from './theme';

/** Neutral circular avatar: teal-to-violet disc with a soft head and shoulders silhouette. */
export function Avatar({ size = 40 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48" accessibilityLabel="Profile picture" testID="default-avatar">
      <Defs>
        <LinearGradient id="avatarBg" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={colors.surfaceAlt} />
          <Stop offset="1" stopColor={colors.bgDeep} />
        </LinearGradient>
      </Defs>
      <Circle cx="24" cy="24" r="23.5" fill="url(#avatarBg)" stroke={colors.borderStrong} />
      <Circle cx="24" cy="19" r="7" fill={colors.teal} opacity={0.85} />
      <Path d="M9 40c1.5-8 7.5-12 15-12s13.5 4 15 12c-4.2 4.6-9.2 6.5-15 6.5S13.2 44.6 9 40z" fill={colors.tealDeep} opacity={0.7} />
    </Svg>
  );
}
