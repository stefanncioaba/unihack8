// Bottom panel for a tapped event: the event card plus "Open event" and "Directions" (PLAN 14.3).
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { EventListItem } from '@/features/events/EventCards';
import { useEvent } from '@/hooks/queries';
import { Button } from '@/ui/Button';
import { ErrorState, LoadingState } from '@/ui/States';

import { useMapContext } from './MapContext';

/** Details of the selected event (loaded on demand). */
export function EventPanel({ id }: { id: string }) {
  const event = useEvent(id);
  const { setDestination } = useMapContext();

  if (event.isPending) return <LoadingState />;
  if (event.isError) return <ErrorState error={event.error} onRetry={() => event.refetch()} />;

  const e = event.data;
  return (
    <View style={{ gap: 10 }} testID="event-panel">
      {/* The card already opens the event when tapped. */}
      <View style={{ paddingRight: 22 }}>
        <EventListItem event={e} />
      </View>
      <View style={styles.actions}>
        <Button title="Open event" icon="arrow-forward" small onPress={() => router.push(`/events/${e.id}`)} style={{ flex: 1 }} />
        {e.lat !== null && e.lon !== null && (
          <Button
            title="Directions"
            icon="navigate-outline"
            iconLeft
            small
            variant="secondary"
            onPress={() => setDestination({ coords: { lat: e.lat as number, lon: e.lon as number }, title: e.title })}
            style={{ flex: 1 }}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', gap: 10 },
});
