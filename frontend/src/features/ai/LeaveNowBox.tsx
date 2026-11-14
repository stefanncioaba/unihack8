// "Leave now" box under an AI route card (PLAN 25): which tram/bus to catch, at which stop, and a live countdown
// to when the user has to start walking. "Will I make it?" is answered by the box's state.
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import type { ChatLeaveNow } from '@/api/types.ai';
import { formatTime } from '@/lib/time';
import { Icon } from '@/ui/Icon';
import { Text } from '@/ui/Text';
import { colors, radius } from '@/ui/theme';

/** How the trip looks right now. */
export type LeaveState =
  /** More than an hour away: "Leave at 05:12". */
  | { kind: 'later' }
  /** "Leave in N min". */
  | { kind: 'soon'; minutes: number }
  /** Time to go. */
  | { kind: 'now' }
  /** The spare minute is gone but walking straight there still makes it. */
  | { kind: 'hurry' }
  /** The vehicle reaches the stop before the user can. */
  | { kind: 'missed' };

const MINUTE = 60_000;

/** The state of the trip at `now` (ms): compares now with leaveAt and with the last moment the walk still works. */
export function leaveState(leave: ChatLeaveNow, now: number): LeaveState {
  const leaveAt = Date.parse(leave.leaveAt);
  const lastChance = Date.parse(leave.boardAt) - leave.walkMinutes * MINUTE;
  if (now > lastChance) return { kind: 'missed' };
  if (now > leaveAt + 30_000) return { kind: 'hurry' };
  const minutes = Math.floor((leaveAt - now) / MINUTE);
  if (minutes < 1) return { kind: 'now' };
  if (minutes > 60) return { kind: 'later' };
  return { kind: 'soon', minutes };
}

/** "tram", "trolleybus" or "bus" for a line type. */
export function vehicleNoun(type: string): string {
  const t = type.toUpperCase();
  if (t === 'TRAM') return 'tram';
  if (t === 'TROLLEYBUS') return 'trolleybus';
  return 'bus';
}

/** Headline of the box for a state. */
function headline(state: LeaveState, leave: ChatLeaveNow): string {
  switch (state.kind) {
    case 'later':
      return `Leave at ${formatTime(leave.leaveAt)}`;
    case 'soon':
      return `Leave in ${state.minutes} min`;
    case 'now':
      return 'Leave now';
    case 'hurry':
      return 'Hurry, leave right now';
    case 'missed':
      return "You won't make this one";
  }
}

/** Ticks every few seconds so the countdown stays right while the answer is on screen. */
function useNow(everyMs = 10_000): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), everyMs);
    return () => clearInterval(t);
  }, [everyMs]);
  return now;
}

/** The box: headline countdown, the vehicle to catch, the walk, and where the time comes from. */
export function LeaveNowBox({ leave, index }: { leave: ChatLeaveNow; index: number }) {
  const now = useNow();
  const state = leaveState(leave, now);
  const missed = state.kind === 'missed';
  const vehicle = vehicleNoun(leave.vehicleType);
  const towards = leave.headsign ? ` towards ${leave.headsign}` : '';
  const at = leave.stopName ? ` at ${leave.stopName}` : '';
  const sourceLabel = leave.source === 'LIVE' ? 'Live' : leave.source === 'TIMETABLE' ? 'Scheduled' : 'Planned';

  const tone = missed ? colors.danger : colors.gold;

  return (
    <View
      style={[styles.box, missed && styles.boxMissed]}
      testID={`leave-now-${index}`}
      accessible
      accessibilityLabel={`${headline(state, leave)}, ${vehicle} ${leave.line}${at}`}
    >
      {/* Same layout as the cost box (CostCard): badge, small label, big gold headline, then detail lines. */}
      <View style={styles.head}>
        <View style={[styles.badge, missed && { backgroundColor: colors.danger }]}>
          <Icon name={missed ? 'alert-circle-outline' : 'time-outline'} size={16} color={colors.onAccent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="caption" tone={missed ? 'danger' : 'accent'} style={styles.label}>
            {missed ? 'WILL I MAKE IT?' : 'LEAVE NOW'}
          </Text>
          <Text style={[styles.amount, { color: tone }, missed && styles.amountMissed]} testID="leave-now-headline">
            {headline(state, leave)}
          </Text>
        </View>
        <View style={styles.pill}>
          {leave.source === 'LIVE' ? <View style={styles.dot} /> : null}
          <Text variant="chip" tone="muted">
            {sourceLabel}
          </Text>
        </View>
      </View>
      <View style={[styles.items, missed && styles.itemsMissed]}>
        <View style={styles.item}>
          <Icon name={vehicle === 'tram' ? 'train-outline' : 'bus-outline'} size={13} color={tone} />
          <Text variant="caption" style={{ flex: 1 }}>
            {missed ? 'It was the ' : 'to catch '}
            <Text variant="caption" style={styles.strong}>
              {vehicle} {leave.line}
            </Text>
            {towards}
            {at} at {formatTime(leave.boardAt)}
            {missed ? '. Tap Go or ask again for the next one.' : ''}
          </Text>
        </View>
        <View style={styles.item}>
          <Icon name="walk-outline" size={13} color={tone} />
          <Text variant="caption" tone="muted" style={{ flex: 1 }}>
            {leave.walkMinutes} min walk to the stop
            {leave.missedBoardAt ? ` · the ${formatTime(leave.missedBoardAt)} one leaves too soon` : ''}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    alignSelf: 'stretch',
    borderWidth: 1.5,
    borderColor: colors.accent,
    borderRadius: radius.card,
    backgroundColor: 'rgba(255,195,0,0.08)',
    padding: 14,
    gap: 10,
  },
  boxMissed: { borderColor: colors.danger, backgroundColor: 'rgba(255,107,107,0.08)' },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  badge: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  label: { letterSpacing: 0.8 },
  amount: { fontSize: 24, fontWeight: '800', lineHeight: 30, letterSpacing: -0.5 },
  amountMissed: { fontSize: 18, lineHeight: 23 },
  items: { gap: 6, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,195,0,0.35)' },
  itemsMissed: { borderTopColor: 'rgba(255,107,107,0.35)' },
  item: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  strong: { fontWeight: '700' },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.chip,
    backgroundColor: colors.surfaceAlt,
  },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#3DDC84' },
});
