// Yellow pins for events in the visible area (PLAN 14.3). A tap opens the event panel.
import { memo, useCallback, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Marker } from 'react-native-maps';

import type { EventSummary } from '@/api/types';
import { categoryMeta } from '@/features/events/categories';
import type { Bbox } from '@/lib/bbox';
import { clusterPoints, clusterZoomTarget, shouldCluster, spreadStacked } from '@/lib/cluster';
import { Icon } from '@/ui/Icon';
import { Text } from '@/ui/Text';
import { colors } from '@/ui/theme';

import { ClusterMarker, useBriefViewTracking } from './ClusterMarker';

type Props = {
  events: EventSummary[];
  selectedId?: string;
  showLabels: boolean;
  onSelect: (id: string) => void;
  /** Visible area, used to group nearby pins when zoomed out. */
  bbox: Bbox | null;
  /** Zoom the map in on a point (tapping a cluster), optionally to a given view span. */
  onZoomTo: (lat: number, lon: number, span?: number) => void;
};

/** One event pin: yellow badge with the category icon, optional title pill. */
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

/** Pin anchor (one shared object). */
const CENTER = { x: 0.5, y: 0.5 };

/** One event marker; redraws briefly when it appears or its look changes (see useBriefViewTracking). Memoised, so a
 * pan or a panel change does not re-render every pin. */
const EventMarker = memo(function EventMarker({ event, selected, showLabel, onSelect }: { event: LocatedEvent; selected: boolean; showLabel: boolean; onSelect: (id: string) => void }) {
  const tracking = useBriefViewTracking(`${selected}:${showLabel}`);
  const coordinate = useMemo(() => ({ latitude: event.lat, longitude: event.lon }), [event.lat, event.lon]);
  const press = useCallback(() => onSelect(event.id), [onSelect, event.id]);
  return (
    <Marker testID={`event-marker-${event.id}`} coordinate={coordinate} onPress={press} tracksViewChanges={tracking} anchor={CENTER}>
      <EventPin event={event} selected={selected} showLabel={showLabel} />
    </Marker>
  );
});

/** An event that has coordinates (the shape the clustering needs). */
type LocatedEvent = EventSummary & { lat: number; lon: number };

/** All event pins (events without coordinates are skipped); nearby ones are grouped into count bubbles when zoomed
 * out, at any zoom level, so events stay visible city-wide. Tapping a bubble zooms in to fit its events; events at the
 * very same spot are then fanned out slightly so each one can be tapped. */
function EventMarkersBase({ events, selectedId, showLabels, onSelect, bbox, onZoomTo }: Props) {
  const located = useMemo(() => events.filter((e): e is LocatedEvent => e.lat !== null && e.lon !== null), [events]);
  const { singles, clusters } = useMemo(() => {
    const grouped = clusterPoints(located, bbox, shouldCluster(bbox));
    // Events at the same venue would be drawn on top of each other once zoomed in: fan them out.
    return { clusters: grouped.clusters, singles: spreadStacked(grouped.singles, bbox ? bbox.maxLat - bbox.minLat : 0) };
  }, [located, bbox]);
  return (
    <>
      {clusters.map((c) => (
        <ClusterMarker
          key={c.id}
          id={c.id}
          lat={c.lat}
          lon={c.lon}
          count={c.items.length}
          color={colors.gold}
          onPress={() => {
            const t = clusterZoomTarget(c.items, bbox ? bbox.maxLat - bbox.minLat : 0);
            onZoomTo(t.lat, t.lon, t.span);
          }}
        />
      ))}
      {singles.map((e) => (
        <EventMarker key={e.id} event={e} selected={e.id === selectedId} showLabel={showLabels} onSelect={onSelect} />
      ))}
    </>
  );
}

/** Memoised: re-renders only when its events, view, selection or labels change. */
export const EventMarkers = memo(EventMarkersBase);

const styles = StyleSheet.create({
  pin: { alignItems: 'center', gap: 3 },
  badge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.gold,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.9)',
  },
  badgeSelected: { backgroundColor: colors.signal, transform: [{ scale: 1.15 }] },
  label: { paddingHorizontal: 8, height: 20, borderRadius: 10, justifyContent: 'center', backgroundColor: 'rgba(0,8,20,0.88)' },
});
