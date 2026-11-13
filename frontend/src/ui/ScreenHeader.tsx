// Header row for stack screens: back button, title, optional right-hand action.
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Icon } from './Icon';
import { Text } from './Text';
import { colors } from './theme';

type Props = { title: string; subtitle?: string; right?: ReactNode; hideBack?: boolean };

/** Goes back, or to the Home tab when there is nothing to go back to (deep link). */
function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

/** Compact header: 36 px round back button, bold title, and a right slot. */
export function ScreenHeader({ title, subtitle, right, hideBack }: Props) {
  return (
    <View style={styles.row}>
      {!hideBack && (
        <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={goBack} style={styles.back} hitSlop={8}>
          <Icon name="chevron-back" size={18} />
        </Pressable>
      )}
      <View style={styles.titles}>
        <Text variant="title" numberOfLines={1} accessibilityRole="header">
          {title}
        </Text>
        {subtitle ? (
          <Text variant="caption" tone="muted" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 8, paddingBottom: 12 },
  back: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  titles: { flex: 1 },
});
