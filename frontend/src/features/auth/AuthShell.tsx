// Shared layout of the sign-in and sign-up screens: abstract light motif, title, form, footer link.
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { Card } from '@/ui/Card';
import { Screen } from '@/ui/Screen';
import { Text } from '@/ui/Text';
import { colors } from '@/ui/theme';

import { useAuth } from './AuthProvider';

/** Minimal geometric cyan/orange light motif for the breathing zone above the title. */
function Motif() {
  return (
    <Svg width={120} height={120} viewBox="0 0 120 120" accessibilityElementsHidden>
      <Defs>
        <LinearGradient id="ring" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={colors.signal} />
          <Stop offset="1" stopColor={colors.accent} />
        </LinearGradient>
      </Defs>
      <Circle cx="60" cy="60" r="44" stroke="url(#ring)" strokeWidth="2" fill="none" opacity={0.9} />
      <Circle cx="60" cy="60" r="26" stroke={colors.signal} strokeWidth="1" fill="none" opacity={0.45} />
      <Circle cx="60" cy="60" r="6" fill={colors.accent} />
      <Rect x="58" y="6" width="4" height="10" rx="2" fill={colors.signal} opacity={0.7} />
    </Svg>
  );
}

type Props = { title: string; subtitle: string; children: ReactNode; footer: ReactNode };

/** Page frame for the auth forms; also warns when the Supabase keys are missing. */
export function AuthShell({ title, subtitle, children, footer }: Props) {
  const { configured } = useAuth();
  return (
    <Screen scroll glow="lamp" edges={['top', 'bottom']}>
      <View style={styles.motif}>
        <Motif />
      </View>
      <Text variant="title" style={styles.center}>
        {title}
      </Text>
      <Text tone="muted" style={[styles.center, styles.subtitle]}>
        {subtitle}
      </Text>
      {!configured && (
        <Card style={styles.warning} testID="config-warning">
          <Text variant="caption" tone="accent">
            Supabase is not configured. Copy frontend/.env.example to frontend/.env, fill in the URL and key, then restart Expo.
          </Text>
        </Card>
      )}
      <View style={styles.form}>{children}</View>
      <View style={styles.footer}>{footer}</View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  motif: { alignItems: 'center', paddingTop: 32, paddingBottom: 12 },
  center: { textAlign: 'center' },
  subtitle: { marginTop: 4, marginBottom: 20 },
  warning: { marginBottom: 12, borderColor: colors.accent },
  form: { gap: 14 },
  footer: { alignItems: 'center', marginTop: 20, flexDirection: 'row', justifyContent: 'center', gap: 6 },
});
