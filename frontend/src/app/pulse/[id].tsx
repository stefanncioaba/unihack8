// One neighbourhood's panel (opened by tapping its Pulse card): photo header, then tabs Events | Help.
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, ImageBackground, Pressable, StyleSheet, View } from 'react-native';

import { EventListItem } from '@/features/events/EventCards';
import { areaBbox, inArea } from '@/features/neighbourhoods/areas';
import { neighbourhoodPhoto } from '@/features/neighbourhoods/photos';
import { LEVEL_META } from '@/features/neighbourhoods/pulseFormat';
import { useEventsInArea } from '@/hooks/useMapEvents';
import { useNeighbourhoodPulse } from '@/hooks/useNeighbourhoods';
import { StatusChip } from '@/ui/Chip';
import { Screen } from '@/ui/Screen';
import { ScreenHeader } from '@/ui/ScreenHeader';
import { EmptyState, ErrorState, LoadingState } from '@/ui/States';
import { Text } from '@/ui/Text';
import { colors, PAGE_MARGIN, radius } from '@/ui/theme';

export type AreaTab = 'events' | 'help';

/** Two-button tab switch under the header. */
function Tabs({ tab, onChange }: { tab: AreaTab; onChange: (t: AreaTab) => void }) {
  return (
    <View style={styles.tabs} accessibilityRole="tablist">
      {(['events', 'help'] as const).map((t) => (
        <Pressable
          key={t}
          accessibilityRole="tab"
          accessibilityState={{ selected: tab === t }}
          onPress={() => onChange(t)}
          style={[styles.tab, tab === t && styles.tabOn]}
          testID={`area-tab-${t}`}
        >
          <Text variant="chip" style={{ color: tab === t ? colors.onAccent : colors.textMuted }}>
            {t === 'events' ? 'Events' : 'Help'}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

/** Upcoming events inside the area (same nearest-centre rule as the backend). */
function EventsTab({ areaId, areas }: { areaId: string; areas: Parameters<typeof inArea>[2] }) {
  const area = areas.find((a) => a.id === areaId)!;
  const query = useEventsInArea(areaBbox(area));
  const events = useMemo(() => (query.data ? inArea(query.data.items, areaId, areas) : []), [query.data, areaId, areas]);
  if (query.isPending) return <LoadingState label="Loading events…" />;
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  if (events.length === 0) return <EmptyState icon="calendar-outline" title="No upcoming events here" message="Nothing planned in this neighbourhood yet." />;
  return <FlatList data={events} keyExtractor={(e) => e.id} renderItem={({ item }) => <EventListItem event={item} />} contentContainerStyle={styles.list} testID="area-events" />;
}

/** Help requests in the area: filled in once the Neighbour Help Board is merged. */
function HelpTab() {
  return <EmptyState icon="hand-left-outline" title="Neighbour help" message="Help requests in this neighbourhood will show here." />;
}

/** The neighbourhood panel screen. */
export default function NeighbourhoodScreen() {
  const { id, tab: initialTab } = useLocalSearchParams<{ id: string; tab?: string }>();
  const [tab, setTab] = useState<AreaTab>(initialTab === 'help' ? 'help' : 'events');
  const pulse = useNeighbourhoodPulse();
  const area = pulse.data?.areas.find((a) => a.id === id);

  if (pulse.isPending) return <Screen><LoadingState label="Loading…" /></Screen>;
  if (pulse.isError) return <Screen><ErrorState error={pulse.error} onRetry={() => pulse.refetch()} /></Screen>;
  if (!area) {
    return (
      <Screen>
        <ScreenHeader title="Neighbourhood" />
        <EmptyState icon="map-outline" title="Neighbourhood not found" message="It may have been renamed. Go back and pick another one." />
      </Screen>
    );
  }

  const photo = neighbourhoodPhoto(area.id);
  const level = LEVEL_META[area.level] ?? LEVEL_META.QUIET;
  return (
    <Screen padded={false} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <ScreenHeader title={area.name} right={<StatusChip label={level.label} tone={level.tone} />} />
      </View>
      {photo ? (
        <ImageBackground source={photo.source} style={styles.photo} imageStyle={{ borderRadius: radius.card }} testID={`area-photo-${area.id}`}>
          <LinearGradient colors={['rgba(0,8,20,0)', 'rgba(0,8,20,0.8)']} style={styles.shade}>
            <Text variant="caption" tone="muted" style={{ fontSize: 9 }}>
              Photo: {photo.credit}
            </Text>
          </LinearGradient>
        </ImageBackground>
      ) : null}
      <Tabs tab={tab} onChange={setTab} />
      <View style={styles.body}>{tab === 'events' ? <EventsTab areaId={area.id} areas={pulse.data.areas} /> : <HelpTab />}</View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: PAGE_MARGIN },
  photo: { height: 130, marginHorizontal: PAGE_MARGIN, marginBottom: 12 },
  shade: { flex: 1, justifyContent: 'flex-end', padding: 8, borderRadius: radius.card },
  tabs: { flexDirection: 'row', gap: 8, marginHorizontal: PAGE_MARGIN, marginBottom: 10, padding: 4, borderRadius: radius.chip, backgroundColor: colors.surfaceAlt, alignSelf: 'flex-start' },
  tab: { paddingHorizontal: 18, height: 30, borderRadius: radius.chip, alignItems: 'center', justifyContent: 'center' },
  tabOn: { backgroundColor: colors.accent },
  body: { flex: 1 },
  list: { gap: 10, paddingHorizontal: PAGE_MARGIN, paddingBottom: 24 },
});
