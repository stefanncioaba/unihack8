// Orange pins for events in the visible area (PLAN 14.3). A tap opens the event panel.
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Marker } from 'react-native-maps';

import type { EventSummary } from '@/api/types';
import { categoryMeta } from '@/features/events/categories';
import type { Bbox } from '@/lib/bbox';
import { clusterPoints, shouldCluster } from '@/lib/cluster';
import { Icon } from '@/ui/Icon';
import { Text } from '@/ui/Text';
import { colors } from '@/ui/theme';

import { ClusterMarker } from './ClusterMarker';

type Props = {
  events: EventSummary[];
  selectedId?: string;
  showLabels: boolean;
  onSelect: (id: string) => void;
  /** Visible area, used to group nearby pins when zoomed out. */
  bbox: Bbox | null;
  /** Zoom the map in on a point (tapping a cluster). */
  onZoomTo: (lat: number, lon: number) => void;
};

/** One event pin: orange badge with the category icon, optional title pill. */
function EventPin({ event, selected, showLabel }: { event: EventSummary; selected: boolean; showLabel: boolean }) {
  return (
    <View style={styles.pin}>
      <View style={[styles.badge, selected && styles.badgeSelected]}>
        <Icon name={categoryMeta(event.category).icon} size={15} color={colors.onAccent} />
      </View>
      {(showLabel || selected) && (
        <View style={styles.label}>
          <Text variant="chip" numberOfLines={1} style={{ maxWidth: 130 }}>
            {event.title}
          </Text>
        </View>
      )}
    </View>
  );
}

/** An event that has coordinates (the shape the clustering needs). */
type LocatedEvent = EventSummary & { lat: number; lon: number };

/** All event pins (events without coordinates are skipped); nearby ones are grouped when zoomed out. */
export function EventMarkers({ events, selectedId, showLabels, onSelect, bbox, onZoomTo }: Props) {
  const located = useMemo(() => events.filter((e): e is LocatedEvent => e.lat !== null && e.lon !== null), [events]);
  const { singles, clusters } = useMemo(() => clusterPoints(located, bbox, shouldCluster(bbox)), [located, bbox]);
  return (
    <>
      {clusters.map((c) => (
        <ClusterMarker key={c.id} id={c.id} lat={c.lat} lon={c.lon} count={c.items.length} color={colors.orangeSoft} onPress={() => onZoomTo(c.lat, c.lon)} />
      ))}
      {singles.map((e) => (
        <Marker
          key={e.id}
          testID={`event-marker-${e.id}`}
          coordinate={{ latitude: e.lat, longitude: e.lon }}
          onPress={() => onSelect(e.id)}
          tracksViewChanges={false}
          anchor={{ x: 0.5, y: 0.5 }}
        >
          <EventPin event={e} selected={e.id === selectedId} showLabel={showLabels} />
        </Marker>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  pin: { alignItems: 'center', gap: 3 },
  badge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.orangeSoft,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.9)',
  },
  badgeSelected: { backgroundColor: colors.teal, transform: [{ scale: 1.15 }] },
  label: { paddingHorizontal: 8, height: 20, borderRadius: 10, justifyContent: 'center', backgroundColor: 'rgba(9,10,24,0.88)' },
});
