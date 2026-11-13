// "City info" strip on Home: last tram/bus near you and active transit alerts (PLAN 13.1).
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useTransitAlerts, useTransitSummary } from '@/hooks/queries';
import { useCurrentPosition } from '@/features/location/LocationProvider';
import { Card } from '@/ui/Card';
import { Icon } from '@/ui/Icon';
import { Text } from '@/ui/Text';
import { colors } from '@/ui/theme';

/** Compact card with the "last tram" line; the alert pill expands the list of alerts. */
export function CityInfoStrip() {
  const { position } = useCurrentPosition();
  const summary = useTransitSummary(position);
  const alerts = useTransitAlerts();
  const [open, setOpen] = useState(false);

  const count = alerts.data?.length ?? summary.data?.activeAlerts ?? 0;

  /** The line of text next to the tram icon. */
  function message() {
    if (summary.isPending) return { text: 'Loading transit info…', tone: 'muted' as const };
    if (summary.isError) return { text: 'Live transit info is unavailable right now.', tone: 'muted' as const };
    return { text: summary.data.message, tone: 'primary' as const };
  }
  const line = message();

  return (
    <Card testID="city-info-strip" style={styles.card}>
      <View style={styles.row}>
        <View style={styles.icon}>
          <Icon name="train-outline" size={18} color={colors.teal} />
        </View>
        <View style={styles.text}>
          <Text variant="caption" tone="muted">
            Public transport near you
          </Text>
          <Text numberOfLines={2} tone={line.tone}>
            {line.text}
          </Text>
        </View>
        {summary.isError ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Retry transit info" onPress={() => summary.refetch()} hitSlop={8}>
            <Icon name="refresh" size={18} color={colors.textMuted} />
          </Pressable>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={count === 0 ? 'No transit alerts' : `${count} transit alerts`}
            disabled={count === 0}
            onPress={() => setOpen((v) => !v)}
            style={[styles.pill, count > 0 && styles.pillActive]}
          >
            <Icon name={count > 0 ? 'warning-outline' : 'checkmark-circle-outline'} size={13} color={count > 0 ? colors.orangeSoft : colors.teal} />
            <Text variant="chip" style={{ color: count > 0 ? colors.orangeSoft : colors.teal }}>
              {count > 0 ? `${count} ${count === 1 ? 'alert' : 'alerts'}` : 'No alerts'}
            </Text>
          </Pressable>
        )}
      </View>
      {open && alerts.data && (
        <View style={styles.alerts} testID="alert-list">
          {alerts.data.map((alert) => (
            <View key={alert.id} style={styles.alert}>
              <Text variant="cardTitle">{alert.title}</Text>
              {alert.description ? (
                <Text variant="caption" tone="muted">
                  {alert.description}
                </Text>
              ) : null}
            </View>
          ))}
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  icon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(23,215,211,0.10)',
  },
  text: { flex: 1, gap: 1 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 26,
    paddingHorizontal: 9,
    borderRadius: 13,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  pillActive: { borderColor: colors.orange, backgroundColor: 'rgba(255,113,56,0.10)' },
  alerts: { gap: 10, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  alert: { gap: 2 },
});
