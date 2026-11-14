// Five stars: read-only (with half stars for averages) or a tappable picker for writing a review.
import { Pressable, StyleSheet, View } from 'react-native';

import { Icon, type IconName } from '@/ui/Icon';
import { colors } from '@/ui/theme';

type Props = {
  /** 0–5; averages may have decimals. */
  value: number;
  size?: number;
  /** When set, every star is a button that picks that rating. */
  onChange?: (rating: number) => void;
  testID?: string;
};

const STARS = [1, 2, 3, 4, 5];

/** Icon for star `n` given the value: full, half (read-only only) or empty. */
function starIcon(n: number, value: number): IconName {
  if (value >= n - 0.25) return 'star';
  if (value >= n - 0.75) return 'star-half';
  return 'star-outline';
}

/** Row of five stars in signal yellow. */
export function StarRating({ value, size = 16, onChange, testID }: Props) {
  if (onChange) {
    return (
      <View style={styles.row} testID={testID} accessibilityRole="radiogroup" accessibilityLabel="Your rating">
        {STARS.map((n) => (
          <Pressable
            key={n}
            accessibilityRole="radio"
            accessibilityLabel={`${n} ${n === 1 ? 'star' : 'stars'}`}
            accessibilityState={{ selected: value === n, checked: value === n }}
            hitSlop={6}
            onPress={() => onChange(n)}
            style={styles.pick}
          >
            <Icon name={n <= value ? 'star' : 'star-outline'} size={size} color={colors.accent} />
          </Pressable>
        ))}
      </View>
    );
  }
  return (
    <View style={styles.row} testID={testID} accessible accessibilityLabel={`Rated ${value.toFixed(1)} out of 5`}>
      {STARS.map((n) => (
        <Icon key={n} name={starIcon(n, value)} size={size} color={colors.accent} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  pick: { padding: 4 },
});
