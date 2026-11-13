// Date and time picker built from chips and steppers, so it is always in Bucharest time
// and needs no native module (works in Expo Go on every phone).
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { bucharestToUtcIso, formatDay, toBucharest } from '@/lib/time';
import { Chip } from '@/ui/Chip';
import { Icon } from '@/ui/Icon';
import { Text } from '@/ui/Text';
import { colors } from '@/ui/theme';

const DAYS_AHEAD = 14;
const MINUTE_STEP = 5;

type Props = { value: string; onChange: (iso: string) => void; error?: string };

/** Round −/+ stepper around a two-digit number. */
function Stepper({ label, value, onStep }: { label: string; value: number; onStep: (delta: number) => void }) {
  return (
    <View style={styles.stepper}>
      <Pressable accessibilityRole="button" accessibilityLabel={`Decrease ${label}`} onPress={() => onStep(-1)} style={styles.stepButton} hitSlop={6}>
        <Icon name="remove" size={16} />
      </Pressable>
      <Text variant="heading" style={styles.stepValue} accessibilityLabel={`${label} ${value}`}>
        {String(value).padStart(2, '0')}
      </Text>
      <Pressable accessibilityRole="button" accessibilityLabel={`Increase ${label}`} onPress={() => onStep(1)} style={styles.stepButton} hitSlop={6}>
        <Icon name="add" size={16} />
      </Pressable>
    </View>
  );
}

/** Pick one of the next 14 days, then set the hour and minute. */
export function DateTimeField({ value, onChange, error }: Props) {
  const wall = toBucharest(value);
  const days = useMemo(() => {
    const today = toBucharest(Date.now());
    return Array.from({ length: DAYS_AHEAD }, (_, i) => {
      const d = new Date(Date.UTC(today.year, today.month - 1, today.day + i));
      const parts = { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
      const label = i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : formatDay(bucharestToUtcIso({ ...parts, hour: 12, minute: 0 }));
      return { ...parts, label };
    });
  }, []);

  /** Sets new wall-clock parts and reports the UTC time. */
  function update(next: Partial<{ year: number; month: number; day: number; hour: number; minute: number }>) {
    onChange(bucharestToUtcIso({ year: wall.year, month: wall.month, day: wall.day, hour: wall.hour, minute: wall.minute, ...next }));
  }

  return (
    <View style={{ gap: 10 }}>
      <Text variant="caption" tone="muted">
        Date and time (Romania)
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {days.map((d) => (
          <Chip
            key={`${d.year}-${d.month}-${d.day}`}
            label={d.label}
            selected={d.year === wall.year && d.month === wall.month && d.day === wall.day}
            onPress={() => update({ year: d.year, month: d.month, day: d.day })}
          />
        ))}
      </ScrollView>
      <View style={styles.time}>
        <Stepper label="hour" value={wall.hour} onStep={(delta) => update({ hour: (wall.hour + delta + 24) % 24 })} />
        <Text variant="title">:</Text>
        <Stepper label="minute" value={wall.minute} onStep={(delta) => update({ minute: (wall.minute + delta * MINUTE_STEP + 60) % 60 })} />
      </View>
      {error ? (
        <Text variant="caption" tone="danger">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  time: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
  },
  stepValue: { minWidth: 30, textAlign: 'center' },
});
