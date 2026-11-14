// "City info" on Home, drawn as a departure board: route plate of the next arrival at the nearest stop,
// the server's sentence, the arrival time in big gold numerals ("in N min" or "last one" under it)
// and the alerts pill underneath (PLAN 13.1).
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useTransitAlerts, useTransitSummary } from '@/hooks/useTransit';
import { useCurrentPosition } from '@/features/location/LocationProvider';
import { formatTime } from '@/lib/time';
import { Icon } from '@/ui/Icon';
import { RoutePlate } from '@/ui/RoutePlate';
import { Text } from '@/ui/Text';
import { colors, radius } from '@/ui/theme';

/** Departure board; the alert pill expands the list of alerts. */
export function CityInfoStrip() {
  const { position } = useCurrentPosition();
  const summary = useTransitSummary(position);
  const alerts = useTransitAlerts();
  const [open, setOpen] = useState(false);

  const count = alerts.data?.length ?? summary.data?.activeAlerts ?? 0;
  const next = summary.isError ? null : (summary.data?.nextArrival ?? null);
  const stop = summary.data?.nearestStop ?? null;

  /** The line of text next to the plate. */
  function message() {
    if (summary.isPending) return { text: 'Loading transit info…', tone: 'muted' as const };
    if (summary.isError) return { text: 'Live transit info is unavailable right now.', tone: 'muted' as const };
    return { text: summary.data.message, tone: 'primary' as const };
  }
  const line = message();

  return (
    <View testID="city-info-strip" style={styles.board}>
      <View style={styles.top}>
        {next ? (
          <RoutePlate label={next.route} size="lg" accessibilityLabel={`Line ${next.route}`} />
        ) : (
          <RoutePlate icon="train-outline" size="lg" />
        )}
        <Text numberOfLines={3} tone={line.tone} style={styles.message}>
          {line.text}
        </Text>
        {next ? (
          <View style={styles.time}>
            <Text style={styles.clock}>{formatTime(next.arrivesAt)}</Text>
            {next.last ? (
              <Text variant="chip" style={styles.lastOne}>
                last one
              </Text>
            ) : (
              <Text variant="caption" tone="muted">
                {arrivalIn(next.minutes)}
              </Text>
            )}
          </View>
        ) : null}
      </View>

      <View style={styles.foot}>
        <Text variant="caption" tone="muted" numberOfLines={1} style={styles.stop}>
          {stop && !summary.isError ? `Nearest stop · ${stop.name} · ${stop.distanceMeters} m` : 'Public transport near you'}
        </Text>
        {summary.isError ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Retry transit info" onPress={() => summary.refetch()} hitSlop={8} style={styles.pill}>
            <Icon name="refresh" size={13} color={colors.textMuted} />
            <Text variant="chip" tone="muted">
              Retry
            </Text>
          </Pressable>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={count === 0 ? 'No transit alerts' : `${count} transit alerts`}
            disabled={count === 0}
            onPress={() => setOpen((v) => !v)}
            hitSlop={8}
            style={styles.pill}
          >
            <Icon name={count > 0 ? 'warning-outline' : 'checkmark-circle-outline'} size={13} color={count > 0 ? colors.gold : colors.signal} />
            <Text variant="chip" style={{ color: count > 0 ? colors.gold : colors.signal }}>
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
    </View>
  );
}

/** Caption under the arrival time: "now" or "in N min". */
export function arrivalIn(minutes: number): string {
  return minutes <= 0 ? 'now' : `in ${minutes} min`;
}

const styles = StyleSheet.create({
  board: {
    borderRadius: radius.card,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  top: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  message: { flex: 1 },
  time: { alignItems: 'flex-end' },
  clock: { fontSize: 28, lineHeight: 32, fontWeight: '800', letterSpacing: -1, color: colors.gold, fontVariant: ['tabular-nums'] },
  foot: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 9,
    backgroundColor: 'rgba(0,8,20,0.45)',
    borderTopWidth: 1,
    borderTopColor: colors.borderStrong,
    borderStyle: 'dashed',
  },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  stop: { flex: 1, marginRight: 8 },
  lastOne: { color: colors.gold, textTransform: 'uppercase' },
  alerts: { gap: 10, padding: 14, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  alert: { gap: 2 },
});
