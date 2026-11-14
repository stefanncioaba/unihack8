// Small rounded filter / status chips.
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Icon, type IconName } from './Icon';
import { Text } from './Text';
import { colors, radius } from './theme';

type Props = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: IconName;
  /** Layout tweaks only (margins, size). Colours come from `selected` / `overMap`, so they can't be wiped out. */
  style?: StyleProp<ViewStyle>;
  /** Translucent navy fill with a stronger border, readable over the map. */
  overMap?: boolean;
  testID?: string;
};

/** Background / border / text colours for a chip in each state (exported for tests). */
export function chipColors(selected: boolean, overMap: boolean) {
  if (selected) return { backgroundColor: colors.accent, borderColor: colors.accent, fg: colors.onAccent };
  if (overMap) return { backgroundColor: MAP_CHIP_BG, borderColor: colors.borderStrong, fg: colors.text };
  return { backgroundColor: colors.surface, borderColor: colors.border, fg: colors.textMuted };
}

/** Translucent Prussian Blue used by controls floating over the map. */
export const MAP_CHIP_BG = 'rgba(0,29,61,0.92)';

/** Pressable style for a chip. State colours go last so a caller's style can never override the selected yellow;
 * pressed only dims and shrinks it. */
export function chipStyle(selected: boolean, overMap: boolean, style?: StyleProp<ViewStyle>) {
  const { backgroundColor, borderColor } = chipColors(selected, overMap);
  return ({ pressed }: { pressed: boolean }): StyleProp<ViewStyle> => [styles.chip, style, { backgroundColor, borderColor }, pressed && styles.pressed];
}

/** Filter chip: navy when idle, solid signal yellow with ink text when selected. Pressing only dims and shrinks it a
 * little, so a selected chip keeps its yellow while the finger is down. */
export function Chip({ label, selected = false, onPress, icon, style, overMap = false, testID }: Props) {
  const { fg } = chipColors(selected, overMap);
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={chipStyle(selected, overMap, style)}
    >
      {icon && <Icon name={icon} size={12} color={fg} />}
      <Text variant="chip" style={{ color: fg }}>
        {label}
      </Text>
    </Pressable>
  );
}

/** Non-interactive status pill (e.g. "Live", participant state). */
export function StatusChip({ label, tone = 'accent' }: { label: string; tone?: 'accent' | 'signal' | 'muted' | 'danger' }) {
  const palette = {
    accent: { bg: colors.accent, fg: colors.onAccent },
    signal: { bg: 'rgba(142,197,255,0.14)', fg: colors.signal },
    muted: { bg: colors.surfaceAlt, fg: colors.textMuted },
    danger: { bg: 'rgba(255,107,107,0.14)', fg: colors.danger },
  }[tone];
  return (
    <View style={[styles.status, { backgroundColor: palette.bg }]}>
      <Text variant="chip" style={{ color: palette.fg, fontSize: 10 }}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 32,
    paddingHorizontal: 12,
    borderRadius: radius.chip,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  pressed: { opacity: 0.8, transform: [{ scale: 0.96 }] },
  status: { paddingHorizontal: 9, height: 22, borderRadius: radius.chip, alignItems: 'center', justifyContent: 'center' },
});
