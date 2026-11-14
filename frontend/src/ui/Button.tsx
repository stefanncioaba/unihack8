// Buttons. Signal yellow (primary) marks the main action of a screen; others stay quiet.
import { ActivityIndicator, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Icon, type IconName } from './Icon';
import { Text } from './Text';
import { colors, radius } from './theme';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

type Props = {
  title: string;
  onPress?: () => void;
  variant?: Variant;
  /** Small trailing (or leading when `iconLeft`) icon. */
  icon?: IconName;
  iconLeft?: boolean;
  loading?: boolean;
  disabled?: boolean;
  /** Compact height for use inside cards and rows. */
  small?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/** Foreground colour per variant. */
function foreground(variant: Variant): string {
  if (variant === 'primary') return colors.onAccent;
  if (variant === 'danger') return colors.danger;
  if (variant === 'ghost') return colors.gold;
  return colors.text;
}

/** App button with loading and disabled states. */
export function Button({ title, onPress, variant = 'primary', icon, iconLeft, loading, disabled, small, style, testID }: Props) {
  const inactive = disabled || loading;
  const fg = foreground(variant);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      testID={testID}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        small ? styles.small : styles.regular,
        variant === 'primary' && styles.primary,
        variant === 'secondary' && styles.secondary,
        variant === 'danger' && styles.danger,
        inactive && { opacity: 0.5 },
        pressed && { opacity: 0.8 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <View style={styles.row}>
          {icon && iconLeft && <Icon name={icon} size={small ? 14 : 16} color={fg} />}
          <Text variant={small ? 'chip' : 'cardTitle'} style={{ color: fg }}>
            {title}
          </Text>
          {icon && !iconLeft && <Icon name={icon} size={small ? 14 : 16} color={fg} />}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center', borderRadius: radius.button },
  regular: { minHeight: 48, paddingHorizontal: 18 },
  small: { minHeight: 32, paddingHorizontal: 12, borderRadius: radius.chip },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  primary: { backgroundColor: colors.accent },
  secondary: { backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.borderStrong },
  danger: { backgroundColor: 'rgba(255,107,107,0.10)', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,107,107,0.45)' },
});
