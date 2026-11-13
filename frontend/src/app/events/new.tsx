// Create-event form: title, description, category, date/time, capacity, location picked on a map (PLAN 13.5).
import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { friendlyError } from '@/api/errors';
import { EVENT_CATEGORIES } from '@/api/types';
import { CATEGORY_META } from '@/features/events/categories';
import { DateTimeField } from '@/features/events/DateTimeField';
import { LocationPickerModal } from '@/features/events/LocationPickerModal';
import { emptyForm, validateEventForm, type EventForm, type FormErrors } from '@/features/events/newEventForm';
import { useCurrentPosition } from '@/features/location/LocationProvider';
import { useCreateEvent } from '@/hooks/queries';
import { Button } from '@/ui/Button';
import { Chip } from '@/ui/Chip';
import { Screen } from '@/ui/Screen';
import { ScreenHeader } from '@/ui/ScreenHeader';
import { Text } from '@/ui/Text';
import { TextField } from '@/ui/TextField';

/** The form for organising your own event. */
export default function NewEventScreen() {
  const { position } = useCurrentPosition();
  const create = useCreateEvent();
  const [form, setForm] = useState<EventForm>(() => emptyForm());
  const [errors, setErrors] = useState<FormErrors>({});
  const [picking, setPicking] = useState(false);

  /** Updates one field and clears its error. */
  function set<K extends keyof EventForm>(key: K, value: EventForm[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key === 'point' ? 'point' : key]: undefined }));
  }

  /** Validates, creates the event, then opens its page. */
  function submit() {
    const result = validateEventForm(form);
    setErrors(result.errors);
    if (!result.payload) return;
    create.mutate(result.payload, { onSuccess: (event) => router.replace(`/events/${event.id}`) });
  }

  return (
    <Screen edges={['top', 'bottom']}>
      <ScreenHeader title="New event" />
      <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <TextField label="Title" value={form.title} onChangeText={(v) => set('title', v)} error={errors.title} placeholder="Board games night" maxLength={120} />
        <TextField label="Description" value={form.description} onChangeText={(v) => set('description', v)} placeholder="What should people know?" multiline />

        <View style={{ gap: 8 }}>
          <Text variant="caption" tone="muted">
            Category
          </Text>
          <View style={styles.wrap}>
            {EVENT_CATEGORIES.map((c) => (
              <Chip key={c} label={CATEGORY_META[c].label} icon={CATEGORY_META[c].icon} selected={form.category === c} onPress={() => set('category', c)} />
            ))}
          </View>
          {errors.category ? (
            <Text variant="caption" tone="danger">
              {errors.category}
            </Text>
          ) : null}
        </View>

        <DateTimeField value={form.startsAt} onChange={(iso) => set('startsAt', iso)} error={errors.startsAt} />

        <View style={{ gap: 8 }}>
          <Text variant="caption" tone="muted">
            Spots
          </Text>
          <View style={styles.wrap}>
            <Chip label="Unlimited" selected={!form.limited} onPress={() => set('limited', false)} />
            <Chip label="Limited" selected={form.limited} onPress={() => set('limited', true)} />
          </View>
          {form.limited && (
            <TextField
              label="Capacity"
              value={form.capacity}
              onChangeText={(v) => set('capacity', v.replace(/[^0-9]/g, ''))}
              error={errors.capacity}
              keyboardType="number-pad"
              placeholder="10"
              maxLength={4}
            />
          )}
        </View>

        <TextField label="Venue name (optional)" value={form.venueName} onChangeText={(v) => set('venueName', v)} placeholder="Scârț Loc Lejer" />
        <TextField label="Address (optional)" value={form.address} onChangeText={(v) => set('address', v)} placeholder="Strada Mărășești 1" />

        <View style={{ gap: 8 }}>
          <Text variant="caption" tone="muted">
            Location
          </Text>
          <Button
            title={form.point ? `Pinned at ${form.point.lat.toFixed(4)}, ${form.point.lon.toFixed(4)}` : 'Choose on map'}
            variant="secondary"
            icon="map-outline"
            iconLeft
            onPress={() => setPicking(true)}
          />
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
        <Button title="Create event" icon="arrow-forward" loading={create.isPending} onPress={submit} />
      </ScrollView>

      <LocationPickerModal
        visible={picking}
        center={position}
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
  form: { gap: 16, paddingBottom: 32 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
