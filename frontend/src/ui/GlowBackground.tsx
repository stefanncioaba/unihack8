// Full-screen ink background with a navy night-sky bloom at the top (and an optional street-lamp glow).
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

import { colors } from './theme';

export type GlowKind = 'night' | 'lamp' | 'none';

/** A diffuse radial glow anchored at one point of the screen. */
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

/** `night`: Oxford Navy sky over the top of the screen. `lamp`: the same sky plus faint gold at the upper left. */
export function GlowBackground({ kind = 'night' }: { kind?: GlowKind }) {
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: colors.bg }]}>
      {kind !== 'none' && (
        <Svg style={StyleSheet.absoluteFill}>
          <Glow id="skyGlow" color={colors.oxford} opacity={0.85} cx="75%" cy="0%" rx="110%" ry="40%" />
          {kind === 'lamp' && <Glow id="lampGlow" color={colors.accent} opacity={0.1} cx="0%" cy="0%" rx="70%" ry="28%" />}
        </Svg>
      )}
    </View>
  );
}
