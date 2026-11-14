// "My skills" on the Profile tab (PLAN 28): list my skills, add one, edit or delete any of them. Neighbours see these
// on my profile and next to my offers on the Help Board.
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { friendlyError } from '@/api/errors';
import type { Skill } from '@/api/types';
import { HELP_CATEGORIES, type HelpCategory } from '@/api/types.help';
import { helpCategoryMeta, HELP_CATEGORY_META } from '@/features/help/categories';
import { useAddSkill, useDeleteSkill, useUpdateSkill } from '@/hooks/useUsers';
import { Button } from '@/ui/Button';
import { Chip } from '@/ui/Chip';
import { Icon } from '@/ui/Icon';
import { Text } from '@/ui/Text';
import { TextField } from '@/ui/TextField';
import { colors, radius } from '@/ui/theme';

import { cleanSkillName, SKILL_LIMIT, SKILL_NAME_MAX, validateSkill } from './skills';

/** Which form is open: none, the add form, or editing one skill. */
type Mode = { kind: 'none' } | { kind: 'add' } | { kind: 'edit'; skill: Skill };

/** My skills with add / edit / delete. */
export function SkillsEditor({ skills }: { skills: Skill[] }) {
  const [mode, setMode] = useState<Mode>({ kind: 'none' });
  const remove = useDeleteSkill();
  const full = skills.length >= SKILL_LIMIT;

  /** Asks before deleting, since it cannot be undone. */
  function confirmDelete(skill: Skill) {
    Alert.alert('Delete skill?', `"${skill.name}" will be removed from your profile.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => remove.mutate(skill.id) },
    ]);
  }

  return (
    <View style={{ gap: 10 }} testID="skills-editor">
      <Text variant="caption" tone="muted">
        Neighbours see your skills on your profile and when you offer to help.
      </Text>
      {skills.length === 0 && mode.kind !== 'add' ? (
        <Text tone="muted" testID="skills-empty">
          No skills yet. Add what you are good at, like carpentry or fixing bikes.
        </Text>
      ) : null}
      {skills.map((s) =>
        mode.kind === 'edit' && mode.skill.id === s.id ? (
          <SkillForm key={s.id} editing={s} others={skills.filter((o) => o.id !== s.id)} onDone={() => setMode({ kind: 'none' })} />
        ) : (
          <SkillRow key={s.id} skill={s} onEdit={() => setMode({ kind: 'edit', skill: s })} onDelete={() => confirmDelete(s)} />
        ),
      )}
      {remove.isError ? (
        <Text tone="danger" accessibilityRole="alert">
          {friendlyError(remove.error)}
        </Text>
      ) : null}
      {mode.kind === 'add' ? (
        <SkillForm others={skills} onDone={() => setMode({ kind: 'none' })} />
      ) : full ? (
        <Text variant="caption" tone="muted">
          You listed {SKILL_LIMIT} skills, the most allowed. Delete one to add another.
        </Text>
      ) : (
        <Button title="Add a skill" variant="secondary" icon="add-outline" iconLeft small onPress={() => setMode({ kind: 'add' })} testID="add-skill" />
      )}
    </View>
  );
}

/** One skill with its category and the edit / delete buttons. */
function SkillRow({ skill, onEdit, onDelete }: { skill: Skill; onEdit: () => void; onDelete: () => void }) {
  const meta = helpCategoryMeta(skill.category);
  return (
    <View style={styles.row} testID={`my-skill-${skill.id}`}>
      <View style={styles.icon}>
        <Icon name={meta.icon} size={16} color={colors.signal} />
      </View>
      <View style={{ flex: 1 }}>
        <Text variant="cardTitle" numberOfLines={1}>
          {skill.name}
        </Text>
        <Text variant="caption" tone="muted">
          {meta.label}
        </Text>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel={`Edit ${skill.name}`} onPress={onEdit} hitSlop={8} style={styles.action}>
        <Icon name="create-outline" size={18} color={colors.gold} />
      </Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={`Delete ${skill.name}`} onPress={onDelete} hitSlop={8} style={styles.action}>
        <Icon name="trash-outline" size={18} color={colors.danger} />
      </Pressable>
    </View>
  );
}

/** Name field and category chips; adds a new skill, or saves `editing`. */
function SkillForm({ editing, others, onDone }: { editing?: Skill; others: Skill[]; onDone: () => void }) {
  const [name, setName] = useState(editing?.name ?? '');
  const [category, setCategory] = useState<HelpCategory | null>(editing?.category ?? null);
  const [touched, setTouched] = useState(false);
  const add = useAddSkill();
  const update = useUpdateSkill();
  const saving = add.isPending || update.isPending;
  const localError = touched ? validateSkill(name, category, others) : null;
  const serverError = add.isError ? friendlyError(add.error) : update.isError ? friendlyError(update.error) : null;

  /** Validates, then adds or saves; closes the form on success. */
  function submit() {
    setTouched(true);
    if (validateSkill(name, category, others) || !category) return;
    const input = { name: cleanSkillName(name), category };
    if (editing) update.mutate({ id: editing.id, input }, { onSuccess: onDone });
    else add.mutate(input, { onSuccess: onDone });
  }

  return (
    <View style={styles.form} testID={editing ? `skill-form-${editing.id}` : 'skill-form'}>
      <TextField
        label={editing ? 'Skill' : 'New skill'}
        placeholder="e.g. Carpentry"
        value={name}
        onChangeText={(t) => {
          setName(t);
          add.reset();
          update.reset();
        }}
        error={localError ?? serverError}
        maxLength={SKILL_NAME_MAX}
        autoFocus
        returnKeyType="done"
        onSubmitEditing={submit}
      />
      <Text variant="caption" tone="muted">
        Category
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} keyboardShouldPersistTaps="handled">
        {HELP_CATEGORIES.map((c) => (
          <Chip
            key={c}
            testID={`skill-category-${c}`}
            label={HELP_CATEGORY_META[c].label}
            icon={HELP_CATEGORY_META[c].icon}
            selected={category === c}
            onPress={() => {
              setCategory(c);
              add.reset();
              update.reset();
            }}
          />
        ))}
      </ScrollView>
      <View style={styles.buttons}>
        <Button title={editing ? 'Save' : 'Add'} small loading={saving} onPress={submit} style={styles.flex} testID="save-skill" />
        <Button title="Cancel" small variant="secondary" disabled={saving} onPress={onDone} style={styles.flex} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  icon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(142,197,255,0.10)' },
  action: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceAlt },
  form: { gap: 8, padding: 12, borderRadius: radius.card, backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  chips: { gap: 6, paddingVertical: 2 },
  buttons: { flexDirection: 'row', gap: 10, marginTop: 4 },
  flex: { flex: 1 },
});
