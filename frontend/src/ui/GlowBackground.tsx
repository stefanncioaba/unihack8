// Full-screen dark background with soft, low-opacity colour glows near the top corners.
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

import { colors } from './theme';

export type GlowKind = 'teal' | 'warm' | 'none';

/** A diffuse radial glow anchored at one corner of the screen. */
function Glow({ id, color, opacity, cx, cy, rx, ry }: { id: string; color: string; opacity: number; cx: string; cy: string; rx: string; ry: string }) {
  return (
    <>
      <Defs>
        <RadialGradient id={id} cx={cx} cy={cy} rx={rx} ry={ry} fx={cx} fy={cy}>
          <Stop offset="0" stopColor={color} stopOpacity={opacity} />
          <Stop offset="1" stopColor={color} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id})`} />
    </>
  );
}

/** `teal`: cyan bloom at the upper right. `warm`: purple upper left + burnt orange upper right. */
export function GlowBackground({ kind = 'teal' }: { kind?: GlowKind }) {
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: colors.bg }]}>
      {kind !== 'none' && (
        <Svg style={StyleSheet.absoluteFill}>
          {kind === 'teal' ? (
            <>
              <Glow id="tealGlow" color={colors.tealDeep} opacity={0.34} cx="100%" cy="0%" rx="85%" ry="38%" />
              <Glow id="violetGlow" color={colors.violet} opacity={0.12} cx="0%" cy="0%" rx="60%" ry="25%" />
            </>
          ) : (
            <>
              <Glow id="violetGlow" color={colors.violet} opacity={0.2} cx="0%" cy="0%" rx="80%" ry="34%" />
              <Glow id="orangeGlow" color={colors.orange} opacity={0.16} cx="100%" cy="0%" rx="80%" ry="34%" />
            </>
          )}
        </Svg>
      )}
    </View>
  );
}
