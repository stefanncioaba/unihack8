// Oxford Navy pins for places in the visible area (PLAN 14.2). Pins are ready-made images (see markerImages.ts), so they
// show complete and at once, never cut off or blank, and do not redraw when the camera moves.
import { memo, useCallback, useMemo } from 'react';
import { Marker } from 'react-native-maps';

import type { PlaceSummary } from '@/api/types.places';
import { shouldCluster, clusterPoints, spreadStacked } from '@/lib/cluster';
import type { Bbox } from '@/lib/bbox';

import { ClusterMarker } from './ClusterMarker';
import { PLACE_PIN_IMAGES } from './markerImages';

type Props = {
  places: PlaceSummary[];
  selectedId?: string;
  onSelect: (id: string) => void;
  /** Visible area, used to group nearby pins when zoomed out. */
  bbox: Bbox | null;
  /** Zoom the map in on a point (tapping a cluster). */
  onZoomTo: (lat: number, lon: number) => void;
};

/** Pin images of a place category (an unknown category from a newer backend gets the generic pin). */
export function placePinImages(category: string) {
  return PLACE_PIN_IMAGES[category] ?? PLACE_PIN_IMAGES.default;
}

/** Middle of the pin image sits on the place's position (one shared object). */
const CENTER = { x: 0.5, y: 0.5 };

/** One place marker, memoised so a pan or a panel change does not re-render every pin. */
const PlaceMarker = memo(function PlaceMarker({ place, selected, onSelect }: { place: PlaceSummary; selected: boolean; onSelect: (id: string) => void }) {
  const coordinate = useMemo(() => ({ latitude: place.lat, longitude: place.lon }), [place.lat, place.lon]);
  const press = useCallback(() => onSelect(place.id), [onSelect, place.id]);
  const images = placePinImages(place.category);
  return (
    <Marker
      testID={`place-marker-${place.id}`}
      coordinate={coordinate}
      onPress={press}
      image={selected ? images.selected : images.normal}
      anchor={CENTER}
      tracksViewChanges={false}
      zIndex={selected ? 2 : 1}
    />
  );
});

/** All place pins: lone pins plus count bubbles for nearby ones when zoomed out. */
function PlaceMarkersBase({ places, selectedId, onSelect, bbox, onZoomTo }: Props) {
  // Places sharing one spot (several shops in one building) would hide each other once zoomed in: fan them out.
  const { singles, clusters } = useMemo(() => {
    const grouped = clusterPoints(places, bbox, shouldCluster(bbox));
    return { clusters: grouped.clusters, singles: spreadStacked(grouped.singles, bbox ? bbox.maxLat - bbox.minLat : 0) };
  }, [places, bbox]);
  return (
    <>
      {clusters.map((c) => (
        <ClusterMarker key={c.id} id={c.id} lat={c.lat} lon={c.lon} count={c.items.length} kind="place" onPress={() => onZoomTo(c.lat, c.lon)} />
      ))}
      {singles.map((p) => (
        <PlaceMarker key={p.id} place={p} selected={p.id === selectedId} onSelect={onSelect} />
      ))}
    </>
  );
}

/** Memoised: re-renders only when its places, view or selection change. */
export const PlaceMarkers = memo(PlaceMarkersBase);
