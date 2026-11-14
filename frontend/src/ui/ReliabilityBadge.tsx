// Small badge that shows someone's reliability score, coloured by how trustworthy it is.
import { StyleSheet, View } from 'react-native';

import { Icon } from './Icon';
import { Text } from './Text';
import { colors } from './theme';

/** Signal blue for 90+, gold for 60–89, red below 60. */
export function reliabilityColor(score: number): string {
  if (score >= 90) return colors.signal;
  if (score >= 60) return colors.gold;
  return colors.danger;
}

/** `★ 115` style pill. */
export function ReliabilityBadge({ score }: { score: number }) {
  const color = reliabilityColor(score);
  return (
    <View style={[styles.pill, { borderColor: color }]} accessibilityLabel={`Reliability ${score}`}>
      <Icon name="shield-checkmark-outline" size={12} color={color} />
      <Text variant="chip" style={{ color }}>
        {score}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 22,
    paddingHorizontal: 8,
    borderRadius: 11,
    borderWidth: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
});
