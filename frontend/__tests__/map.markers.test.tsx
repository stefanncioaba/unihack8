// Map markers and base map: no base-map POIs / stations (Google style + Apple Maps props), every custom marker root has
// an explicit size that holds its children (no negative margins, no scale transforms, no shadows), and markers keep
// redrawing until the icon font is loaded (the cause of half-drawn icons on the map).
import { act, render, screen } from '@testing-library/react-native';
import { StyleSheet, Text as RNText } from 'react-native';

import type { PlaceSummary } from '@/api/types.places';
import type { EventSummary } from '@/api/types';
import type { TransitStop, TransitVehicle } from '@/api/types.transit';
import MapScreen from '@/app/(tabs)/map';
import { TripStepMarker, tripStepImage } from '@/features/directions/TripMarkers';
import type { TripStep } from '@/features/directions/tripSteps';
import { ClusterMarker, MARKER_TRACK_MS, useBriefViewTracking } from '@/features/map/ClusterMarker';
import { EventMarkers } from '@/features/map/EventMarkers';
import { clusterImage } from '@/features/map/markerImages';
import { PlaceMarkers } from '@/features/map/PlaceMarkers';
import { TransitLayer } from '@/features/transit/TransitLayer';
import { VehicleMarker, badgeSize, vehicleImages } from '@/features/transit/VehicleMarker';
import { iconFontLoaded } from '@/ui/Icon';
import { HIDDEN_POI_TYPES, HIDDEN_TRANSIT_TYPES, darkMapStyle } from '@/ui/mapStyle';

import { renderScreen } from './testUtils';

// An icon set with a real font entry and an expo-font whose load the test finishes by hand, so the "font not loaded
// yet" state can be checked. The font starts unloaded; the first test loads it, later tests run with it loaded.
// (Kept on globalThis: jest.mock factories run before this file's own constants exist.)
type FontState = { loaded: boolean; resolve: null | (() => void) };
jest.mock('expo-font', () => {
  const state: FontState = { loaded: false, resolve: null };
  (globalThis as { __iconFont?: FontState }).__iconFont = state;
  return {
    isLoaded: () => state.loaded,
    loadAsync: () =>
      new Promise<void>((resolve) => {
        state.resolve = () => {
          state.loaded = true;
          resolve();
        };
      }),
  };
});
const mockFont = (globalThis as unknown as { __iconFont: FontState }).__iconFont;
jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const { View } = require('react-native');
  const Ionicons = ({ name }: { name: string }) => React.createElement(View, { testID: `icon-${name}` });
  Ionicons.glyphMap = {};
  Ionicons.font = { ionicons: 1 };
  return { Ionicons };
});

/** Prints the tracking hook's value. */
function Probe() {
  return <RNText testID="tracking">{String(useBriefViewTracking('x'))}</RNText>;
}

/** A rendered host node. */
type ReactTestInstance = ReturnType<typeof screen.getByTestId>;

/** Flattened style of a node. */
const flat = (node: ReactTestInstance) => StyleSheet.flatten(node.props.style) ?? {};

/** Every host node under (and including) a root. */
function allNodes(root: ReactTestInstance): ReactTestInstance[] {
  return [root, ...root.findAll(() => true)];
}

/** Checks a marker root: explicit numeric size, collapsable off, every sized child fits inside, no negative margins,
 * no transforms and no shadows anywhere in it. Absolutely placed layers (the vehicle halo and bearing arrow) are only
 * allowed with explicit numeric left / top / width / height that keep them inside the root's box. */
function expectContained(root: ReactTestInstance) {
  const style = flat(root);
  expect(typeof style.width).toBe('number');
  expect(typeof style.height).toBe('number');
  expect(root.props.collapsable).toBe(false);
  for (const node of allNodes(root)) {
    const s = flat(node);
    for (const key of ['margin', 'marginTop', 'marginBottom', 'marginLeft', 'marginRight', 'marginHorizontal', 'marginVertical'] as const) {
      if (typeof s[key] === 'number') expect(s[key]).toBeGreaterThanOrEqual(0);
    }
    expect(s.transform).toBeUndefined();
    expect(s.shadowOpacity).toBeUndefined();
    if (s.position === 'absolute') {
      for (const key of ['left', 'top', 'width', 'height'] as const) expect(typeof s[key]).toBe('number');
      expect(s.left as number).toBeGreaterThanOrEqual(0);
      expect(s.top as number).toBeGreaterThanOrEqual(0);
      expect((s.left as number) + (s.width as number)).toBeLessThanOrEqual(style.width as number);
      expect((s.top as number) + (s.height as number)).toBeLessThanOrEqual(style.height as number);
    }
    if (node !== root) {
      if (typeof s.width === 'number') expect(s.width).toBeLessThanOrEqual(style.width as number);
      if (typeof s.height === 'number') expect(s.height).toBeLessThanOrEqual(style.height as number);
      if (typeof s.maxWidth === 'number') expect(s.maxWidth).toBeLessThanOrEqual(style.width as number);
    }
  }
}

const place: PlaceSummary = { id: 'p1', osmId: 'n1', name: 'A rather long cafe name for a pill', category: 'cafe', lat: 45.75, lon: 21.22, address: null, distanceMeters: null };
const event: EventSummary = {
  id: 'e1',
  source: 'USER',
  title: 'Party at the river',
  category: 'PARTY',
  venueName: null,
  lat: 45.76,
  lon: 21.23,
  startsAt: '2026-11-14T18:00:00Z',
  endsAt: null,
  imageUrl: null,
  priceMin: null,
  priceMax: null,
  capacity: null,
  spotsLeft: null,
  averageRating: null,
  reviewCount: 0,
};
const vehicle: TransitVehicle = {
  id: 'v1',
  route: '1',
  routeName: 'Tv14',
  type: 'TROLLEYBUS',
  color: null,
  lat: 45.75,
  lon: 21.22,
  bearing: null,
  speedKmh: null,
  headsign: null,
  nextStop: null,
  accessible: false,
  reportedAt: '2026-11-14T16:00:00Z',
};
const stop: TransitStop = { id: 's1', name: 'Piața Libertății', lat: 45.75, lon: 21.22, routes: ['1'] };
const step = (kind: TripStep['kind'], label: string): TripStep => ({
  key: `${kind}-0`,
  kind,
  legIndex: 0,
  mode: kind === 'walk' ? 'WALK' : 'TRAM',
  coord: { lat: 45.75, lon: 21.22 },
  label,
  color: kind === 'walk' ? null : '#E53935',
  icon: kind === 'walk' ? 'walk-outline' : 'train-outline',
});
const noop = () => undefined;

describe('icon font and marker tracking', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('keeps tracking on until the icon font is loaded, then snapshots again and stops', async () => {
    expect(iconFontLoaded()).toBe(false);
    render(<Probe />);
    act(() => jest.advanceTimersByTime(MARKER_TRACK_MS * 5));
    expect(screen.getByTestId('tracking').props.children).toBe('true'); // font still loading: keep redrawing

    await act(async () => {
      mockFont.resolve?.();
    });
    expect(iconFontLoaded()).toBe(true);
    expect(screen.getByTestId('tracking').props.children).toBe('true'); // a fresh window with the icon drawn
    act(() => jest.advanceTimersByTime(MARKER_TRACK_MS));
    expect(screen.getByTestId('tracking').props.children).toBe('false');
  });

  it('place pins are image markers: nothing to snapshot, so tracking is never on', () => {
    render(<PlaceMarkers places={[place]} onSelect={noop} bbox={null} onZoomTo={noop} />);
    expect(screen.getByTestId('place-marker-p1').props.tracksViewChanges).toBe(false);
    expect(screen.getByTestId('place-marker-p1').props.image).toBeDefined();
  });
});

describe('base map shows only our data', () => {
  it('hides every POI type and the base-map transit stations (labels and icons)', () => {
    for (const featureType of [...HIDDEN_POI_TYPES, ...HIDDEN_TRANSIT_TYPES]) {
      for (const elementType of ['labels', 'labels.icon']) {
        expect(darkMapStyle).toContainEqual({ featureType, elementType, stylers: [{ visibility: 'off' }] });
      }
    }
    for (const t of ['poi', 'poi.business', 'poi.attraction', 'poi.park', 'poi.place_of_worship', 'poi.school', 'poi.medical', 'poi.government', 'poi.sports_complex', 'transit.station']) {
      expect([...HIDDEN_POI_TYPES, ...HIDDEN_TRANSIT_TYPES] as string[]).toContain(t);
    }
  });

  it('keeps street names readable (no rule hides road or general labels text)', () => {
    const hidesText = darkMapStyle.filter(
      (r) => r.stylers?.some((s) => (s as { visibility?: string }).visibility === 'off') && (r.elementType === 'labels' || r.elementType === 'labels.text'),
    );
    expect(hidesText.every((r) => r.featureType?.startsWith('poi') || r.featureType?.startsWith('transit'))).toBe(true);
  });

  it('the MapView gets the props that hide POIs, buildings, indoor maps, traffic and the toolbar', () => {
    renderScreen(<MapScreen />);
    const map = screen.getByTestId('main-map');
    expect(map.props).toMatchObject({
      showsPointsOfInterest: false,
      showsBuildings: false,
      showsIndoors: false,
      showsIndoorLevelPicker: false,
      showsTraffic: false,
      toolbarEnabled: false,
      customMapStyle: darkMapStyle,
    });
  });
});

describe('place and event pins are ready-made images', () => {
  it('place pin: image per category, another image when selected, centred on the position', () => {
    const { rerender } = render(<PlaceMarkers places={[place]} onSelect={noop} bbox={null} onZoomTo={noop} />);
    const normal = screen.getByTestId('place-marker-p1').props.image;
    expect(normal).toBeDefined();
    expect(screen.getByTestId('place-marker-p1').props.anchor).toEqual({ x: 0.5, y: 0.5 });
    rerender(<PlaceMarkers places={[place]} selectedId="p1" onSelect={noop} bbox={null} onZoomTo={noop} />);
    expect(screen.getByTestId('place-marker-p1').props.image).not.toEqual(normal);
  });

  it('an unknown place category still gets a pin (the generic one)', () => {
    render(<PlaceMarkers places={[{ ...place, category: 'brand_new' as never }]} onSelect={noop} bbox={null} onZoomTo={noop} />);
    expect(screen.getByTestId('place-marker-p1').props.image).toBeDefined();
  });

  it('event pin: image per category, another image when selected', () => {
    const { rerender } = render(<EventMarkers events={[event]} onSelect={noop} bbox={null} onZoomTo={noop} />);
    const normal = screen.getByTestId('event-marker-e1').props.image;
    expect(normal).toBeDefined();
    rerender(<EventMarkers events={[event]} selectedId="e1" onSelect={noop} bbox={null} onZoomTo={noop} />);
    expect(screen.getByTestId('event-marker-e1').props.image).not.toEqual(normal);
  });

  it('cluster bubble: an image for its count (places and events differ, big counts share the "99+" image)', () => {
    render(<ClusterMarker id="c1" lat={45.75} lon={21.22} count={7} kind="place" onPress={noop} />);
    const m = screen.getByTestId('cluster-c1');
    expect(m.props.image).toEqual(clusterImage('place', 7));
    expect(m.props.tracksViewChanges).toBe(false);
    expect(clusterImage('place', 7)).not.toEqual(clusterImage('event', 7));
    expect(clusterImage('place', 7)).not.toEqual(clusterImage('place', 8));
    expect(clusterImage('place', 500)).toEqual(clusterImage('place', 100));
    expect(clusterImage('place', 1)).toEqual(clusterImage('place', 2));
  });
});

describe('marker roots hold their whole content', () => {
  it('vehicle marker is an image per line (selected one differs); an unknown line gets its type badge', () => {
    const { rerender } = render(<VehicleMarker vehicle={vehicle} onPress={noop} />);
    const m = () => screen.getByTestId('vehicle-marker-v1');
    expect(m().props.image).toBe(vehicleImages(vehicle).normal);
    expect(m().props.tracksViewChanges).toBe(false);
    rerender(<VehicleMarker vehicle={vehicle} selected onPress={noop} />);
    expect(m().props.image).toBe(vehicleImages(vehicle).selected);
    expect(vehicleImages(vehicle).selected).not.toBe(vehicleImages(vehicle).normal);
    const unknown = { ...vehicle, route: 'ZZ99', routeName: 'ZZ99' };
    expect(vehicleImages(unknown).normal).toBeDefined();
    expect(vehicleImages({ ...vehicle, route: '1', routeName: '1' }).normal).not.toEqual(vehicleImages(unknown).normal); // a listed line has its own badge
    expect(badgeSize('7', false)).toEqual({ width: 28, height: 28 }); // short names are round (panel badge)
  });

  it('stop dot is an image, bigger and ringed when selected', () => {
    const { rerender } = render(<TransitLayer stops={[stop]} lineId={null} vehicles={[]} onSelectStop={noop} onSelectVehicle={noop} />);
    const normal = screen.getByTestId('stop-marker-s1').props.image;
    expect(normal).toBeDefined();
    rerender(<TransitLayer stops={[stop]} lineId={null} vehicles={[]} selectedStopId="s1" onSelectStop={noop} onSelectVehicle={noop} />);
    expect(screen.getByTestId('stop-marker-s1').props.image).not.toBe(normal);
  });

  it('trip step markers are ready-made badges (board and get-off differ); the text is the tap callout', () => {
    const label = 'Board Tram 1 → Gara de Nord · 18:08';
    const { unmount } = render(<TripStepMarker step={step('board', label)} />);
    const m = screen.getByTestId('trip-step-board-0');
    expect(m.props.image).toBe(tripStepImage({ kind: 'board', color: step('board', label).color }));
    expect(m.props.title).toBe(label);
    expect(m.props.tracksViewChanges).toBe(false);
    expect(tripStepImage({ kind: 'board', color: '#FFD700' })).not.toBe(tripStepImage({ kind: 'alight', color: '#FFD700' }));
    expect(tripStepImage({ kind: 'board', color: '#123456' })).toBeDefined(); // a colour that is no line colour
    unmount();
  });
});
