// Cost box under an assistant answer: the average total (or the average per option) of what the answer recommends,
// in big gold type, with the min–max range and one line per priced place/event. The numbers come from the backend,
// built from stored prices only (docs/API.md -> AI assistant, `cost`).
import { StyleSheet, View } from 'react-native';

import type { ChatCost, ChatCostItem } from '@/api/types.ai';
import { Icon, type IconName } from '@/ui/Icon';
import { Text } from '@/ui/Text';
import { colors, radius } from '@/ui/theme';

/** "5", "7.5", "36" — whole lei from 10 up, one decimal below 10 (no trailing ".0"). */
export function formatLei(lei: number): string {
  const rounded = lei >= 10 ? Math.round(lei) : Math.round(lei * 10) / 10;
  return String(rounded);
}

/** "30–41 lei", or "5 lei" when both ends are the same. */
export function formatRange(min: number, max: number): string {
  const low = formatLei(min);
  const high = formatLei(max);
  return low === high ? `${low} lei` : `${low}–${high} lei`;
}

/** Icon of a cost line by kind. */
function kindIcon(kind: ChatCostItem['kind']): IconName {
  if (kind === 'EVENT') return 'ticket-outline';
  if (kind === 'TICKET') return 'bus-outline';
  return 'restaurant-outline';
}

/** The headline label: a sum for one plan, an average when the answer offers alternatives ("per plan" when the
 * alternatives come with something else, e.g. one of two pizzerias and a concert). */
export function costLabel(cost: ChatCost): string {
  if (cost.basis !== 'OPTIONS') return 'Average total';
  return new Set(cost.items.map((i) => i.kind)).size > 1 ? 'Average per plan' : 'Average per option';
}

/** Everything a screen reader needs in one sentence. */
export function costAccessibilityLabel(cost: ChatCost): string {
  const lines = cost.items.map((i) => `${i.label}, ${i.detail}, ${formatRange(i.minLei, i.maxLei)}`).join('; ');
  return `${costLabel(cost)}: about ${formatLei(cost.averageTotalLei)} lei, range ${formatRange(cost.minTotalLei, cost.maxTotalLei)}. ${lines}.`;
}

/** The eye-catching cost box; renders nothing without a cost. */
export function CostCard({ cost }: { cost?: ChatCost | null }) {
  if (!cost || cost.items.length === 0) return null;
  return (
    <View style={styles.box} testID="chat-cost" accessible accessibilityLabel={costAccessibilityLabel(cost)}>
      <View style={styles.head}>
        <View style={styles.badge}>
          <Icon name="wallet-outline" size={16} color={colors.onAccent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text variant="caption" tone="accent" style={styles.label}>
            {costLabel(cost).toUpperCase()}
          </Text>
          <Text style={styles.amount} testID="chat-cost-total">
            ≈ {formatLei(cost.averageTotalLei)} lei
          </Text>
        </View>
        <Text variant="caption" tone="muted" testID="chat-cost-range">
          {formatRange(cost.minTotalLei, cost.maxTotalLei)}
        </Text>
      </View>
      <View style={styles.items}>
        {cost.items.map((item, index) => (
          <View key={`${item.label}-${index}`} style={styles.item} testID={`chat-cost-item-${index}`}>
            <Icon name={kindIcon(item.kind)} size={13} color={colors.gold} />
            <Text variant="caption" numberOfLines={1} style={{ flex: 1 }}>
              {item.label}
              <Text variant="caption" tone="muted">
                {` · ${item.detail}`}
              </Text>
            </Text>
            <Text variant="caption" tone="accent">
              {formatRange(item.minLei, item.maxLei)}
            </Text>
          </View>
        ))}
      </View>
      {cost.note ? (
        <Text variant="caption" tone="muted">
          {cost.note}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    alignSelf: 'stretch',
    maxWidth: '92%',
    borderWidth: 1.5,
    borderColor: colors.accent,
    borderRadius: radius.card,
    backgroundColor: 'rgba(255,195,0,0.08)',
    padding: 14,
    gap: 10,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  badge: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  label: { letterSpacing: 0.8 },
  amount: { fontSize: 28, fontWeight: '800', lineHeight: 34, color: colors.gold, letterSpacing: -0.5 },
  items: { gap: 6, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,195,0,0.35)' },
  item: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
