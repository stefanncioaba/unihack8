// TanStack Query hooks for places on the map.
import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { getPlace, listPlaces } from '@/api/endpoints.places';
import type { PlaceCategory } from '@/api/types.places';
import { bboxParam, type Bbox } from '@/lib/bbox';

/** Most places the map asks for in one view (the API allows up to 500 with a bbox). */
export const MAX_MAP_PLACES = 300;

/** Cache keys for place queries. */
export const placeKeys = {
  area: (bbox: string, categories: PlaceCategory[]) => ['places', 'area', bbox, [...categories].sort()] as const,
  detail: (id: string) => ['places', 'detail', id] as const,
};

/** Places inside the visible map area (empty `categories` = every category). Keeps the old pins while panning. */
export function usePlacesInArea(bbox: Bbox | null, categories: PlaceCategory[], enabled = true) {
  const param = bbox ? bboxParam(bbox) : '';
  return useQuery({
    queryKey: placeKeys.area(param, categories),
    queryFn: ({ signal }) => listPlaces({ bbox: param, category: categories.length ? categories : undefined, size: MAX_MAP_PLACES }, signal),
    enabled: enabled && !!bbox,
    placeholderData: keepPreviousData,
  });
}

/** Details of one place (opening hours, phone, website...). */
export function usePlace(id: string | undefined) {
  return useQuery({ queryKey: placeKeys.detail(id ?? ''), queryFn: () => getPlace(id!), enabled: !!id });
}
