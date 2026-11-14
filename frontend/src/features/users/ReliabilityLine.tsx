// Reliability score drawn as a transit line: a fixed 0–200 track with a stop every 50 points and the score
// as a yellow route plate on it. The scoring rules sit under the line like a fare table.
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { RoutePlate } from '@/ui/RoutePlate';
import { Text } from '@/ui/Text';
import { colors, radius } from '@/ui/theme';

import { formatPoints, RELIABILITY_RULES, START_SCORE } from './reliability';

/** The line ends here; higher scores sit at the end of the line but still show their real number. */
export const LINE_MAX = 200;
/** Distance between stops. */
export const LINE_STEP = 50;
/** Stops closer than this (in % of the line) to the plate are hidden so the plate never covers a label. */
const PLATE_CLEARANCE = 12;

/** Position of a score along the line, in percent (0–100). */
export function linePosition(score: number): number {
  return (Math.min(Math.max(score, 0), LINE_MAX) / LINE_MAX) * 100;
}

export type LineStop = { value: number; passed: boolean; next: boolean };

/** Stops to draw for a score: passed ones are filled, the next one up is highlighted, ones under the plate are left out. */
export function lineStops(score: number): LineStop[] {
  const next = score >= LINE_MAX ? null : Math.floor(Math.max(score, 0) / LINE_STEP) * LINE_STEP + LINE_STEP;
  const stops: LineStop[] = [];
  for (let v = 0; v <= LINE_MAX; v += LINE_STEP) {
    if (Math.abs(linePosition(v) - linePosition(score)) < PLATE_CLEARANCE) continue;
    stops.push({ value: v, passed: v < score, next: v === next });
  }
  return stops;
}

/** Short text for the corner of the card: how far the next stop is. */
export function nextStopLabel(score: number): string {
  if (score >= LINE_MAX) return 'End of the line';
  const next = Math.floor(Math.max(score, 0) / LINE_STEP) * LINE_STEP + LINE_STEP;
  return `${next - score} points to ${next}`;
}

/** Card with the line and the rules. */
export function ReliabilityLine({ score }: { score: number }) {
  const [width, setWidth] = useState(0);
  const at = (pct: number) => (pct / 100) * width;
  return (
    <View testID="reliability-line" style={styles.card}>
      <View style={styles.head}>
        <Text variant="cardTitle">Reliability</Text>
        <Text variant="caption" tone="muted">
          {nextStopLabel(score)}
        </Text>
      </View>

      <View style={styles.line} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${linePosition(score)}%` }]} />
        </View>
        {width > 0 &&
          lineStops(score).map((s) => (
            // A zero-width anchor at the stop's position keeps the dot and label centred on it.
            <View key={s.value} style={[styles.anchor, { left: at(linePosition(s.value)) }]}>
              <View style={[styles.dot, s.passed && styles.dotPassed]} />
              <Text style={[styles.stopLabel, s.next && styles.stopNext]}>{s.value}</Text>
            </View>
          ))}
        {width > 0 && (
          <View testID="score-plate-anchor" style={[styles.anchor, styles.plateAnchor, { left: at(linePosition(score)) }]}>
            <RoutePlate label={score.toLocaleString('en')} size="md" style={styles.plate} />
          </View>
        )}
        <Text style={styles.hidden} accessibilityLabel={`Reliability score ${score}`}>
          {score}
        </Text>
      </View>

      <View style={styles.fares} testID="score-explainer">
        {RELIABILITY_RULES.map((rule, i) => (
          <View key={rule.text} style={[styles.fare, i > 0 && styles.fareDivider]}>
            <Text variant="heading" style={{ color: rule.points > 0 ? colors.signal : colors.danger }}>
              {formatPoints(rule.points)}
            </Text>
            <Text variant="caption" tone="muted">
              {rule.text}
            </Text>
          </View>
        ))}
      </View>
      <Text variant="caption" tone="muted">
        Everyone starts at {START_SCORE}. The score never drops below 0.
      </Text>
    </View>
  );
}

const PLATE = 42;
/** Width reserved for the score plate (fits up to a 5-character label like `1,020`). */
const PLATE_BOX = 90;

const styles = StyleSheet.create({
  card: {
    gap: 14,
    padding: 14,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  // Side margins leave room for half a plate at 0 and at 200.
  line: { height: 58, marginHorizontal: 26 },
  track: { position: 'absolute', left: 0, right: 0, top: 24, height: 4, borderRadius: 2, backgroundColor: colors.surfaceAlt },
  fill: { height: 4, borderRadius: 2, backgroundColor: colors.accent },
  anchor: { position: 'absolute', top: 20, width: 0, alignItems: 'center' },
  dot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.bg, borderWidth: 2, borderColor: colors.borderStrong },
  dotPassed: { backgroundColor: colors.accent, borderColor: colors.bg },
  stopLabel: { marginTop: 6, width: 40, textAlign: 'center', fontSize: 10.5, color: colors.textMuted, fontVariant: ['tabular-nums'] },
  stopNext: { color: colors.gold, fontWeight: '700' },
  // The plate needs real width: inside the zero-width anchor its text was squeezed to "..". A wide box shifted back by
  // half its width keeps the plate centred on the score.
  plateAnchor: { top: 26 - (PLATE + 6) / 2, width: PLATE_BOX, marginLeft: -PLATE_BOX / 2 },
  plate: { borderWidth: 3, borderColor: colors.surface, borderBottomWidth: 3, height: PLATE + 6 },
  hidden: { position: 'absolute', width: 1, height: 1, opacity: 0 },
  fares: { flexDirection: 'row', paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.borderStrong, borderStyle: 'dashed' },
  fare: { flex: 1, gap: 2, paddingRight: 8 },
  fareDivider: { paddingLeft: 10, borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: colors.border },
});
