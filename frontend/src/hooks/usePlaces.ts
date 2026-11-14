// TanStack Query hooks for places on the map.
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import { getPlace, listPlaces } from '@/api/endpoints.places';
import type { PlaceCategory } from '@/api/types.places';
import { bboxContains, bboxCovers, bboxParam, expandBbox, roundBbox, type Bbox } from '@/lib/bbox';

/** Most places the map asks for in one request (the API allows up to 500 with a bbox). */
export const MAX_MAP_PLACES = 500;

/** Extra room (fraction of the view, each side) fetched around the visible area, so panning and zooming in stay inside
 * data that is already loaded. */
export const FETCH_MARGIN = 0.5;
/** The loaded area is replaced when it is more than this many times wider than the view (zoomed far in), so a capped
 * result of a big area does not hide places once the view is small. */
export const REFETCH_SPAN_RATIO = 4;
/** Pins are kept this far (fraction of the view) outside the screen so a pan shows them before the next update. */
export const VIEW_MARGIN = 0.25;

/** Cache keys for place queries. */
export const placeKeys = {
  area: (bbox: string, categories: PlaceCategory[]) => ['places', 'area', bbox, [...categories].sort()] as const,
  detail: (id: string) => ['places', 'detail', id] as const,
};

/** Decides which area to load: the current one while it still covers the view (and is not far bigger than it), else a
 * new area around the view. Pure, so it is easy to test. */
export function nextFetchArea(current: Bbox | null, view: Bbox): Bbox {
  const tooBig = current && current.maxLat - current.minLat > (view.maxLat - view.minLat) * REFETCH_SPAN_RATIO * (1 + 2 * FETCH_MARGIN);
  if (current && bboxCovers(current, view) && !tooBig) return current;
  return roundBbox(expandBbox(view, FETCH_MARGIN));
}

/** Places inside the visible map area (empty `categories` = every category). One request covers the view plus a margin
 * and is reused while the user pans or zooms in inside it; the pins shown are then picked from it on the phone, so they
 * follow the camera instantly. Keeps the old pins while a new area loads. */
export function usePlacesInArea(bbox: Bbox | null, categories: PlaceCategory[], enabled = true) {
  const [area, setArea] = useState<Bbox | null>(null);
  // Derived during render (not in an effect) so the new area is requested in the same pass.
  const wanted = bbox ? nextFetchArea(area, bbox) : area;
  if (wanted !== area) setArea(wanted);
  const param = wanted ? bboxParam(wanted) : '';
  const query = useQuery({
    queryKey: placeKeys.area(param, categories),
    queryFn: ({ signal }) => listPlaces({ bbox: param, category: categories.length ? categories : undefined, size: MAX_MAP_PLACES }, signal),
    enabled: enabled && !!wanted,
    placeholderData: keepPreviousData,
  });
  const items = query.data?.items;
  // Only the pins in view (with a margin) and in the chosen categories: a narrower filter or a pan needs no request.
  const data = useMemo(() => {
    if (!query.data || !items || !bbox) return query.data;
    const box = expandBbox(bbox, VIEW_MARGIN);
    const visible = items.filter((p) => bboxContains(box, { lat: p.lat, lon: p.lon }) && (categories.length === 0 || categories.includes(p.category as PlaceCategory)));
    return { ...query.data, items: visible };
  }, [query.data, items, bbox, categories]);
  return { ...query, data };
}

/** Details of one place (opening hours, phone, website...). */
export function usePlace(id: string | undefined) {
  return useQuery({ queryKey: placeKeys.detail(id ?? ''), queryFn: () => getPlace(id!), enabled: !!id });
}
