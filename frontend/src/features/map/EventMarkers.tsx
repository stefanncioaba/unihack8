// Yellow pins for events in the visible area (PLAN 14.3). A tap opens the event panel. Pins are ready-made images (see
// markerImages.ts): complete at once, never cut off, no redraw when the camera moves.
import { memo, useCallback, useMemo } from 'react';
import { Marker } from 'react-native-maps';

import type { EventSummary } from '@/api/types';
import type { Bbox } from '@/lib/bbox';
import { clusterPoints, clusterZoomTarget, shouldCluster, spreadStacked } from '@/lib/cluster';

import { ClusterMarker } from './ClusterMarker';
import { EVENT_PIN_IMAGES } from './markerImages';

type Props = {
  events: EventSummary[];
  selectedId?: string;
  onSelect: (id: string) => void;
  /** Visible area, used to group nearby pins when zoomed out. */
  bbox: Bbox | null;
  /** Zoom the map in on a point (tapping a cluster), optionally to a given view span. */
  onZoomTo: (lat: number, lon: number, span?: number) => void;
};

/** Pin images of an event category (unknown ones get the "other" pin). */
export function eventPinImages(category: string) {
  return EVENT_PIN_IMAGES[category] ?? EVENT_PIN_IMAGES.OTHER;
}

/** Middle of the pin image sits on the event's position (one shared object). */
const CENTER = { x: 0.5, y: 0.5 };

/** An event that has coordinates (the shape the clustering needs). */
type LocatedEvent = EventSummary & { lat: number; lon: number };

/** One event marker, memoised so a pan or a panel change does not re-render every pin. */
const EventMarker = memo(function EventMarker({ event, selected, onSelect }: { event: LocatedEvent; selected: boolean; onSelect: (id: string) => void }) {
  const coordinate = useMemo(() => ({ latitude: event.lat, longitude: event.lon }), [event.lat, event.lon]);
  const press = useCallback(() => onSelect(event.id), [onSelect, event.id]);
  const images = eventPinImages(event.category);
  return (
    <Marker
      testID={`event-marker-${event.id}`}
      coordinate={coordinate}
      onPress={press}
      image={selected ? images.selected : images.normal}
      anchor={CENTER}
      tracksViewChanges={false}
      zIndex={selected ? 4 : 3}
    />
  );
});

/** All event pins (events without coordinates are skipped); nearby ones are grouped into count bubbles when zoomed
 * out, at any zoom level, so events stay visible city-wide. Tapping a bubble zooms in to fit its events; events at the
 * very same spot are then fanned out slightly so each one can be tapped. */
function EventMarkersBase({ events, selectedId, onSelect, bbox, onZoomTo }: Props) {
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
          kind="event"
          onPress={() => {
            const t = clusterZoomTarget(c.items, bbox ? bbox.maxLat - bbox.minLat : 0);
            onZoomTo(t.lat, t.lon, t.span);
          }}
        />
      ))}
      {singles.map((e) => (
        <EventMarker key={e.id} event={e} selected={e.id === selectedId} onSelect={onSelect} />
      ))}
    </>
  );
}

/** Memoised: re-renders only when its events, view or selection change. */
export const EventMarkers = memo(EventMarkersBase);
