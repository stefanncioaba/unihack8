// Read-only skill pills (PLAN 28) for profiles and help offers. With `highlight`, skills in that Help Board category
// come first and are drawn in the signal colour with a check mark, so a requester sees who fits the task.
import { StyleSheet, View } from 'react-native';

import type { Skill } from '@/api/types';
import type { HelpCategory } from '@/api/types.help';
import { helpCategoryMeta } from '@/features/help/categories';
import { Icon } from '@/ui/Icon';
import { Text } from '@/ui/Text';
import { colors, radius } from '@/ui/theme';

import { matchingFirst } from './skills';

type Props = { skills: Skill[] | undefined; highlight?: HelpCategory; testID?: string };

/** Wrapped row of pills; renders nothing when there are no skills. */
export function SkillChips({ skills, highlight, testID = 'skill-chips' }: Props) {
  const list = matchingFirst(skills, highlight);
  if (list.length === 0) return null;
  return (
    <View style={styles.wrap} testID={testID}>
      {list.map((s) => {
        const match = s.category === highlight;
        return (
          <View
            key={s.id}
            testID={match ? `skill-match-${s.id}` : `skill-${s.id}`}
            accessibilityLabel={match ? `${s.name}, fits this request` : `${s.name}, ${helpCategoryMeta(s.category).label}`}
            style={[styles.pill, match && styles.match]}
          >
            <Icon name={match ? 'checkmark-circle' : helpCategoryMeta(s.category).icon} size={12} color={match ? colors.signal : colors.textMuted} />
            <Text variant="caption" style={{ color: match ? colors.signal : colors.textMuted }} numberOfLines={1}>
              {s.name}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.chip,
    backgroundColor: colors.surfaceAlt,
    maxWidth: '100%',
  },
  match: { backgroundColor: 'rgba(142,197,255,0.14)' },
});
