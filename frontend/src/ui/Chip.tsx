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
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/** Filter chip: navy when idle, solid signal yellow with ink text when selected. */
export function Chip({ label, selected, onPress, icon, style, testID }: Props) {
  const fg = selected ? colors.onAccent : colors.textMuted;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: !!selected }}
      onPress={onPress}
      style={[styles.chip, selected && styles.selected, style]}
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
  selected: { backgroundColor: colors.accent, borderColor: colors.accent },
  status: { paddingHorizontal: 9, height: 22, borderRadius: radius.chip, alignItems: 'center', justifyContent: 'center' },
});
