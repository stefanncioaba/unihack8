// Places (OpenStreetMap) shapes. Source of truth: docs/API.md -> Places.

export type PlaceCategory =
  | 'restaurant'
  | 'cafe'
  | 'bar'
  | 'fast_food'
  | 'club'
  | 'pharmacy'
  | 'supermarket'
  | 'park'
  | 'attraction'
  | 'atm';

export const PLACE_CATEGORIES: PlaceCategory[] = [
  'restaurant',
  'cafe',
  'bar',
  'fast_food',
  'club',
  'pharmacy',
  'supermarket',
  'park',
  'attraction',
  'atm',
];

export type PlaceSummary = {
  id: string;
  osmId: string;
  name: string;
  category: PlaceCategory;
  lat: number;
  lon: number;
  address: string | null;
  /** Set only when the request had `near`. */
  distanceMeters: number | null;
};

export type PlaceDetail = Omit<PlaceSummary, 'distanceMeters'> & {
  /** OpenStreetMap's raw opening-hours text, or null. */
  openingHours: string | null;
  /** Whitelisted OSM tags: cuisine, website, phone, wheelchair, ... */
  tags: Record<string, string>;
};

export type PlaceQuery = {
  category?: string[];
  /** `minLon,minLat,maxLon,maxLat` */
  bbox?: string;
  near?: string;
  radius?: number;
  q?: string;
  page?: number;
  size?: number;
};
