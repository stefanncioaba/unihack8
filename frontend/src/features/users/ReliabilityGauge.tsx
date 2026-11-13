// Stats band: thick semicircular gauge (orange -> violet -> cyan) beside the big score number.
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import { Text } from '@/ui/Text';
import { colors } from '@/ui/theme';

import { formatPoints, RELIABILITY_RULES, START_SCORE } from './reliability';

/** Scores at or above this fill the gauge completely. */
export const GAUGE_MAX = 150;
const RADIUS = 50;
const ARC_LENGTH = Math.PI * RADIUS;

/** Share of the gauge to fill (0–1) for a score. */
export function gaugeFraction(score: number): number {
  return Math.min(1, Math.max(0, score / GAUGE_MAX));
}

/** Gauge + number + "How it works" link, separated by a thin vertical rule. */
export function ReliabilityGauge({ score }: { score: number }) {
  const [open, setOpen] = useState(false);
  const fraction = gaugeFraction(score);
  return (
    <View testID="reliability-gauge">
      <View style={styles.band}>
        <View style={styles.gauge}>
          <Svg width={130} height={74} viewBox="0 0 120 70" accessibilityLabel={`Reliability gauge at ${Math.round(fraction * 100)} percent`}>
            <Defs>
              <LinearGradient id="gaugeGradient" x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor={colors.orange} />
                <Stop offset="0.5" stopColor={colors.violet} />
                <Stop offset="1" stopColor={colors.teal} />
              </LinearGradient>
            </Defs>
            <Path d="M10 60 A50 50 0 0 1 110 60" stroke={colors.surfaceAlt} strokeWidth={13} strokeLinecap="round" fill="none" />
            <Path
              d="M10 60 A50 50 0 0 1 110 60"
              stroke="url(#gaugeGradient)"
              strokeWidth={13}
              strokeLinecap="round"
              fill="none"
              strokeDasharray={`${ARC_LENGTH} ${ARC_LENGTH}`}
              strokeDashoffset={ARC_LENGTH * (1 - fraction)}
            />
          </Svg>
        </View>
        <View style={styles.divider} />
        <View style={styles.numbers}>
          <Text style={styles.big} accessibilityLabel={`Reliability score ${score}`}>
            {score}
          </Text>
          <Text variant="caption" tone="muted">
            Reliability score
          </Text>
          <Pressable accessibilityRole="button" accessibilityLabel="How the score works" onPress={() => setOpen((v) => !v)} hitSlop={8}>
            <Text variant="caption" tone="accent">
              {open ? 'Hide details' : 'How it works'}
            </Text>
          </Pressable>
        </View>
      </View>
      {open && (
        <View style={styles.explain} testID="score-explainer">
          {RELIABILITY_RULES.map((rule) => (
            <View key={rule.text} style={styles.rule}>
              <Text variant="cardTitle" style={[styles.points, { color: rule.points > 0 ? colors.teal : colors.danger }]}>
                {formatPoints(rule.points)}
              </Text>
              <Text variant="caption" tone="muted" style={{ flex: 1 }}>
                {rule.text}
              </Text>
            </View>
          ))}
          <Text variant="caption" tone="muted">
            Everyone starts at {START_SCORE}. The score never drops below 0.
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  band: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  gauge: { flex: 1, alignItems: 'center' },
  divider: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch', backgroundColor: colors.borderStrong },
  numbers: { flex: 1, gap: 2, alignItems: 'flex-start', paddingLeft: 4 },
  big: { fontSize: 34, fontWeight: '800', lineHeight: 40, color: colors.text },
  explain: { marginTop: 12, gap: 6 },
  rule: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  points: { width: 34 },
});
