// The pre-drawn transit images (scripts/generate_transit_images.py) must match the app's own line colours and cover
// every line type, so a re-run of the script is needed whenever the palette or the shade rule changes.
import { FAMILY_PALETTES, clearLineTypes, lineColor, registerLineTypes } from '@/features/transit/lines';
import { STOP_IMAGES, TYPE_IMAGES, VEHICLE_IMAGES } from '@/features/transit/transitImages';
import { vehicleImages } from '@/features/transit/VehicleMarker';
import type { TransitRouteType } from '@/api/types.transit';

afterEach(() => clearLineTypes());

describe('transit images', () => {
  it('every drawn line has the colour the app gives that line', () => {
    for (const [name, entry] of Object.entries(VEHICLE_IMAGES)) {
      registerLineTypes([{ id: name, type: entry.family as TransitRouteType }]);
      expect({ name, color: lineColor(name).toLowerCase() }).toEqual({ name, color: entry.color.toLowerCase() });
    }
    expect(Object.keys(VEHICLE_IMAGES).length).toBeGreaterThanOrEqual(70);
  });

  it('has a generic badge for every type and a stop dot for every line colour (plus the plain-stop blue)', () => {
    for (const [family, palette] of Object.entries(FAMILY_PALETTES)) {
      expect(TYPE_IMAGES[family]).toBeDefined();
      for (const c of palette) expect(STOP_IMAGES[c.toLowerCase()]).toBeDefined();
    }
    expect(STOP_IMAGES['#8ec5ff']).toBeDefined();
  });

  it('finds a vehicle badge by its line name in any letter case, and falls back to the type badge', () => {
    expect(vehicleImages({ route: 'e1', routeName: null })).toBe(VEHICLE_IMAGES.E1);
    expect(vehicleImages({ route: '33B', routeName: '33b' })).toBe(VEHICLE_IMAGES['33B']);
    expect(vehicleImages({ route: 'ZZ99', routeName: null })).toBe(TYPE_IMAGES.BUS);
  });
});
