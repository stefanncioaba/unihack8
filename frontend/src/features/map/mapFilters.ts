// Map tab layer filters as a small pure reducer: places (with optional categories), events and transport.
// Rule: at least one layer stays visible, so the map is never empty by accident.
import type { PlaceCategory } from '@/api/types.places';

export type MapFilters = {
  /** Place pins are loaded and drawn. */
  placesOn: boolean;
  /** Chosen place categories; empty means every category ("All places"). */
  categories: PlaceCategory[];
  eventsOn: boolean;
  transitOn: boolean;
};

export type MapFilterAction =
  | { type: 'allPlaces' }
  | { type: 'category'; category: PlaceCategory }
  | { type: 'events' }
  | { type: 'transport' };

/** What the Map tab starts with: all places and events, transport off. */
export const INITIAL_MAP_FILTERS: MapFilters = { placesOn: true, categories: [], eventsOn: true, transitOn: false };

/** True when the "All places" chip shows as selected. */
export function allPlacesSelected(f: MapFilters): boolean {
  return f.placesOn && f.categories.length === 0;
}

/** True when a category chip shows as selected. */
export function categorySelected(f: MapFilters, c: PlaceCategory): boolean {
  return f.placesOn && f.categories.includes(c);
}

/** True when at least one layer is visible. */
function anyLayerOn(f: MapFilters): boolean {
  return f.placesOn || f.eventsOn || f.transitOn;
}

/** If a toggle left nothing on screen, bring all places back. */
function keepOneLayer(f: MapFilters): MapFilters {
  return anyLayerOn(f) ? f : { ...f, placesOn: true, categories: [] };
}

/** Applies one chip press to the filters. */
export function mapFiltersReducer(f: MapFilters, action: MapFilterAction): MapFilters {
  switch (action.type) {
    case 'allPlaces':
      if (!allPlacesSelected(f)) return { ...f, placesOn: true, categories: [] };
      // Turning places off is only allowed while another layer is still visible.
      return f.eventsOn || f.transitOn ? { ...f, placesOn: false } : f;
    case 'category': {
      const c = action.category;
      if (!f.placesOn) return { ...f, placesOn: true, categories: [c] };
      const categories = f.categories.includes(c) ? f.categories.filter((x) => x !== c) : [...f.categories, c];
      return { ...f, categories };
    }
    case 'events':
      return keepOneLayer({ ...f, eventsOn: !f.eventsOn });
    case 'transport':
      return keepOneLayer({ ...f, transitOn: !f.transitOn });
    default:
      return f;
  }
}
