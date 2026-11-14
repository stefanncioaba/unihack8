// Map tab layer filters as a small pure reducer: places (with optional categories), events and transport.
// Rule: at least one layer stays visible, so the map is never empty by accident.
// Transport is exclusive (the live network is heavy): turning it on hides places and events and remembers them,
// turning it off brings exactly those filters back.
import type { PlaceCategory } from '@/api/types.places';

/** The non-transport part of the filters, remembered while Transport is on. */
export type NonTransportFilters = {
  placesOn: boolean;
  categories: PlaceCategory[];
  eventsOn: boolean;
};

export type MapFilters = NonTransportFilters & {
  transitOn: boolean;
  /** What places / categories / events were before Transport was turned on; restored when it turns off. */
  beforeTransport?: NonTransportFilters;
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

/** Transport on: remember the other filters and turn them all off. */
function transportOn(f: MapFilters): MapFilters {
  const beforeTransport = { placesOn: f.placesOn, categories: f.categories, eventsOn: f.eventsOn };
  return { placesOn: false, categories: [], eventsOn: false, transitOn: true, beforeTransport };
}

/** Transport off: restore the remembered filters exactly (all places if nothing would be visible). */
function transportOff(f: MapFilters): MapFilters {
  const prev = f.beforeTransport ?? { placesOn: f.placesOn, categories: f.categories, eventsOn: f.eventsOn };
  return keepOneLayer({ placesOn: prev.placesOn, categories: prev.categories, eventsOn: prev.eventsOn, transitOn: false });
}

/** Applies one chip press to the filters. While Transport is on, only the Transport chip does anything. */
export function mapFiltersReducer(f: MapFilters, action: MapFilterAction): MapFilters {
  if (action.type === 'transport') return f.transitOn ? transportOff(f) : transportOn(f);
  if (f.transitOn) return f; // the other chips are disabled while Transport is on
  switch (action.type) {
    case 'allPlaces':
      if (!allPlacesSelected(f)) return { ...f, placesOn: true, categories: [] };
      // Turning places off is only allowed while another layer is still visible.
      return f.eventsOn ? { ...f, placesOn: false } : f;
    case 'category': {
      const c = action.category;
      if (!f.placesOn) return { ...f, placesOn: true, categories: [c] };
      const categories = f.categories.includes(c) ? f.categories.filter((x) => x !== c) : [...f.categories, c];
      return { ...f, categories };
    }
    case 'events':
      return keepOneLayer({ ...f, eventsOn: !f.eventsOn });
    default:
      return f;
  }
}

/** The layers actually drawn. While directions are shown (a route preview or a journey) every filter layer is off, so the
 * map shows only the user, the route, the live vehicles of its lines and the destination. The user's own choices are
 * kept and come back when the directions close. */
export function visibleLayers(f: MapFilters, showingDirections: boolean): MapFilters {
  return showingDirections ? { ...f, placesOn: false, eventsOn: false, transitOn: false } : f;
}
