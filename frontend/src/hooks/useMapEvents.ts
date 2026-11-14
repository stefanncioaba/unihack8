// TanStack Query hook for events shown as markers on the Map tab.
import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { listEvents } from '@/api/endpoints';
import { bboxParam, type Bbox } from '@/lib/bbox';

/** Most events the map asks for in one view (the API allows up to 500 with a bbox). Zoomed out they are clustered. */
export const MAX_MAP_EVENTS = 500;

/** Keeps a map view inside valid coordinates. Zoomed far out the visible region can run past ±180 / ±90, which the
 * API rejects with 400 (and the events would vanish). */
export function clampBbox(b: Bbox): Bbox {
  const clamp = (n: number, limit: number) => Math.min(limit, Math.max(-limit, n));
  return { minLon: clamp(b.minLon, 180), minLat: clamp(b.minLat, 90), maxLon: clamp(b.maxLon, 180), maxLat: clamp(b.maxLat, 90) };
}

/** Upcoming events with coordinates inside the visible area (the API leaves out events without coordinates). */
export function useEventsInArea(bbox: Bbox | null, enabled = true) {
  const param = bbox ? bboxParam(clampBbox(bbox)) : '';
  return useQuery({
    queryKey: ['events', 'map', param] as const,
    queryFn: ({ signal }) => listEvents({ bbox: param, size: MAX_MAP_EVENTS }, signal),
    enabled: enabled && !!bbox,
    placeholderData: keepPreviousData,
  });
}
