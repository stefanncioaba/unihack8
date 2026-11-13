// TanStack Query hook for events shown as markers on the Map tab.
import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { listEvents } from '@/api/endpoints';
import { bboxParam, type Bbox } from '@/lib/bbox';

/** Most events the map asks for in one view. */
export const MAX_MAP_EVENTS = 200;

/** Upcoming events with coordinates inside the visible area (the API leaves out events without coordinates). */
export function useEventsInArea(bbox: Bbox | null, enabled = true) {
  const param = bbox ? bboxParam(bbox) : '';
  return useQuery({
    queryKey: ['events', 'map', param] as const,
    queryFn: ({ signal }) => listEvents({ bbox: param, size: MAX_MAP_EVENTS }, signal),
    enabled: enabled && !!bbox,
    placeholderData: keepPreviousData,
  });
}
