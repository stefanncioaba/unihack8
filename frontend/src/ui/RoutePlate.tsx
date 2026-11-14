// Yellow route-number plate, styled like transit signage. Used for lines (Home board, stop panel)
// and for the reliability score on the reliability line.
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Icon, type IconName } from './Icon';
import { Text } from './Text';
import { colors } from './theme';

type Size = 'sm' | 'md' | 'lg';

const SIZES: Record<Size, { box: number; font: number; radius: number }> = {
  sm: { box: 34, font: 15, radius: 7 },
  md: { box: 42, font: 19, radius: 9 },
  lg: { box: 52, font: 24, radius: 10 },
};

type Props = {
  /** Text on the plate (route name or a number). Ignored when `icon` is set. */
  label?: string;
  /** Shows an icon instead of text (e.g. when the line is unknown). */
  icon?: IconName;
  size?: Size;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  testID?: string;
};

/** Square-ish plate that grows sideways for long labels (e.g. `1,020` or `M14`). */
export function RoutePlate({ label, icon, size = 'md', style, accessibilityLabel, testID }: Props) {
  const s = SIZES[size];
  return (
    <View
      testID={testID}
      accessibilityLabel={accessibilityLabel}
      style={[styles.plate, { minWidth: s.box, height: s.box, borderRadius: s.radius }, style]}
    >
      {icon ? (
        <Icon name={icon} size={s.font} color={colors.onAccent} />
      ) : (
        <Text style={[styles.label, { fontSize: s.font, lineHeight: s.font + 4 }]} numberOfLines={1}>
          {label}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  plate: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    backgroundColor: colors.accent,
    // Darker bottom edge, like a pressed metal sign.
    borderBottomWidth: 3,
    borderBottomColor: 'rgba(0,0,0,0.18)',
  },
  label: { color: colors.onAccent, fontWeight: '900', letterSpacing: -0.5, fontVariant: ['tabular-nums'] },
});
