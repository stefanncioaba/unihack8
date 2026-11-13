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

/** Filter chip: dark when idle, orange-tinted when selected. */
export function Chip({ label, selected, onPress, icon, style, testID }: Props) {
  const fg = selected ? colors.orangeSoft : colors.textMuted;
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
export function StatusChip({ label, tone = 'orange' }: { label: string; tone?: 'orange' | 'teal' | 'muted' | 'danger' }) {
  const palette = {
    orange: { bg: colors.orange, fg: colors.onAccent },
    teal: { bg: 'rgba(23,215,211,0.14)', fg: colors.teal },
    muted: { bg: colors.surfaceAlt, fg: colors.textMuted },
    danger: { bg: 'rgba(255,90,106,0.14)', fg: colors.danger },
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
    height: 30,
    paddingHorizontal: 12,
    borderRadius: radius.chip,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  selected: { backgroundColor: 'rgba(255,113,56,0.14)', borderColor: colors.orange },
  status: { paddingHorizontal: 9, height: 22, borderRadius: radius.chip, alignItems: 'center', justifyContent: 'center' },
});
