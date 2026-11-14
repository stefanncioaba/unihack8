// Loading, empty and error states used by every data screen.
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { friendlyError } from '@/api/errors';

import { Button } from './Button';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';
import { colors } from './theme';

/** Centered spinner with an optional label. */
export function LoadingState({ label }: { label?: string }) {
  return (
    <View style={styles.center} accessibilityRole="progressbar" accessibilityLabel={label ?? 'Loading'} testID="loading-state">
      <ActivityIndicator color={colors.signal} />
      {label ? (
        <Text variant="caption" tone="muted">
          {label}
        </Text>
      ) : null}
    </View>
  );
}

type EmptyProps = { icon?: IconName; title: string; message?: string; actionLabel?: string; onAction?: () => void };

/** "Nothing here yet" with an optional call to action. */
export function EmptyState({ icon = 'sparkles-outline', title, message, actionLabel, onAction }: EmptyProps) {
  return (
    <View style={styles.center} testID="empty-state">
      <View style={styles.badge}>
        <Icon name={icon} size={22} color={colors.signal} />
      </View>
      <Text variant="heading" style={styles.centerText}>
        {title}
      </Text>
      {message ? (
        <Text tone="muted" style={styles.centerText}>
          {message}
        </Text>
      ) : null}
      {actionLabel && onAction ? <Button title={actionLabel} onPress={onAction} variant="secondary" small /> : null}
    </View>
  );
}

/** Error with a friendly message and a retry button. */
export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <View style={styles.center} testID="error-state">
      <View style={[styles.badge, { backgroundColor: 'rgba(255,107,107,0.12)' }]}>
        <Icon name="cloud-offline-outline" size={22} color={colors.danger} />
      </View>
      <Text variant="heading" style={styles.centerText}>
        Something went wrong
      </Text>
      <Text tone="muted" style={styles.centerText}>
        {friendlyError(error)}
      </Text>
      {onRetry ? <Button title="Try again" onPress={onRetry} variant="secondary" small /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 40, paddingHorizontal: 24 },
  centerText: { textAlign: 'center' },
  badge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(142,197,255,0.10)',
  },
});
