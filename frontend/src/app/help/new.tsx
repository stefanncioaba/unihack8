// Ask for help: title, optional description, category, optional address and map pin (PLAN 25).
import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { friendlyError } from '@/api/errors';
import { HELP_ADDRESS_MAX, HELP_CATEGORIES, HELP_DESCRIPTION_MAX, HELP_TITLE_MAX } from '@/api/types.help';
import { LocationPickerModal } from '@/features/events/LocationPickerModal';
import { HELP_CATEGORY_META } from '@/features/help/categories';
import { emptyHelpForm, validateHelpForm, type HelpForm, type HelpFormErrors } from '@/features/help/newHelpForm';
import { useCurrentPosition } from '@/features/location/LocationProvider';
import { useCreateHelpRequest } from '@/hooks/useHelp';
import { Button } from '@/ui/Button';
import { Chip } from '@/ui/Chip';
import { Screen } from '@/ui/Screen';
import { ScreenHeader } from '@/ui/ScreenHeader';
import { Text } from '@/ui/Text';
import { TextField } from '@/ui/TextField';

/** The form for posting a help request; opens the new request's page when done. */
export default function NewHelpRequestScreen() {
  const { position } = useCurrentPosition();
  const create = useCreateHelpRequest();
  const [form, setForm] = useState<HelpForm>(() => emptyHelpForm());
  const [errors, setErrors] = useState<HelpFormErrors>({});
  const [picking, setPicking] = useState(false);

  /** Updates one field and clears its error. */
  function set<K extends keyof HelpForm>(key: K, value: HelpForm[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  }

  /** Validates, posts the request, then opens its page. */
  function submit() {
    const result = validateHelpForm(form);
    setErrors(result.errors);
    if (!result.payload) return;
    create.mutate(result.payload, { onSuccess: (request) => router.replace(`/help/${request.id}`) });
  }

  const category = form.category ? HELP_CATEGORY_META[form.category] : null;

  return (
    <Screen edges={['top', 'bottom']}>
      <ScreenHeader title="Ask for help" subtitle="Open for 24 hours" />
      <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <TextField
          label="What do you need?"
          value={form.title}
          onChangeText={(v) => set('title', v)}
          error={errors.title}
          placeholder="Borrow a ladder for 30 minutes"
          maxLength={HELP_TITLE_MAX}
        />

        <View style={{ gap: 4 }}>
          <TextField
            label="Details (optional)"
            value={form.description}
            onChangeText={(v) => set('description', v)}
            error={errors.description}
            placeholder="When, where, anything a helper should know"
            multiline
            maxLength={HELP_DESCRIPTION_MAX}
          />
          <Text variant="caption" tone="muted" style={styles.counter} testID="description-counter">
            {form.description.length}/{HELP_DESCRIPTION_MAX}
          </Text>
        </View>

        <View style={{ gap: 8 }}>
          <Text variant="caption" tone="muted">
            Category
          </Text>
          <View style={styles.wrap}>
            {HELP_CATEGORIES.map((c) => (
              <Chip key={c} label={HELP_CATEGORY_META[c].label} icon={HELP_CATEGORY_META[c].icon} selected={form.category === c} onPress={() => set('category', c)} />
            ))}
          </View>
          {category ? (
            <Text variant="caption" tone="muted">
              {category.hint}
            </Text>
          ) : null}
          {errors.category ? (
            <Text variant="caption" tone="danger">
              {errors.category}
            </Text>
          ) : null}
        </View>

        <TextField
          label="Address (optional)"
          value={form.address}
          onChangeText={(v) => set('address', v)}
          error={errors.address}
          placeholder="Strada Paris 12"
          maxLength={HELP_ADDRESS_MAX}
        />

        <View style={{ gap: 8 }}>
          <Text variant="caption" tone="muted">
            Location (optional)
          </Text>
          <Button
            title={form.point ? `Pinned at ${form.point.lat.toFixed(4)}, ${form.point.lon.toFixed(4)}` : 'Choose on map'}
            variant="secondary"
            icon="map-outline"
            iconLeft
            onPress={() => setPicking(true)}
          />
          {form.point ? <Button title="Remove pin" variant="ghost" small onPress={() => set('point', null)} /> : null}
          {errors.point ? (
            <Text variant="caption" tone="danger">
              {errors.point}
            </Text>
          ) : null}
        </View>

        {create.isError ? (
          <Text tone="danger" accessibilityRole="alert">
            {friendlyError(create.error)}
          </Text>
        ) : null}
        <Button title="Post request" icon="arrow-forward" loading={create.isPending} onPress={submit} />
      </ScrollView>

      <LocationPickerModal
        visible={picking}
        center={form.point ?? position}
        value={form.point}
        onClose={() => setPicking(false)}
        onConfirm={(point) => {
          set('point', point);
          setPicking(false);
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: { gap: 16, paddingBottom: 32, width: '100%', maxWidth: 720, alignSelf: 'center' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  counter: { alignSelf: 'flex-end' },
});
