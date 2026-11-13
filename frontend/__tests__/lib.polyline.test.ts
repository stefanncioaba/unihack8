// Encoded polylines (routes from OpenTripPlanner) and the distance helper.
import { distanceMeters } from '@/lib/geo';
import { decodePolyline, encodePolyline } from '@/lib/polyline';

describe('polyline', () => {
  it('decodes the reference example from the published format description', () => {
    expect(decodePolyline('_p~iF~ps|U_ulLnnqC_mqNvxq`@')).toEqual([
      { lat: 38.5, lon: -120.2 },
      { lat: 40.7, lon: -120.95 },
      { lat: 43.252, lon: -126.453 },
    ]);
  });

  it('round-trips points with 5 decimals, including negative deltas', () => {
    const points = [
      { lat: 45.7537, lon: 21.2257 },
      { lat: 45.755, lon: 21.228 },
      { lat: 45.7505, lon: 21.2075 },
    ];
    expect(decodePolyline(encodePolyline(points))).toEqual(points);
  });

  it('returns no points for an empty string and stops at a truncated value', () => {
    expect(decodePolyline('')).toEqual([]);
    const full = encodePolyline([{ lat: 45.75, lon: 21.22 }, { lat: 45.76, lon: 21.23 }]);
    expect(decodePolyline(full.slice(0, -1))).toEqual([{ lat: 45.75, lon: 21.22 }]);
  });
});

describe('distanceMeters', () => {
  it('measures about 1.1 km per 0.01 degree of latitude and 0 for the same point', () => {
    expect(distanceMeters({ lat: 45.75, lon: 21.22 }, { lat: 45.76, lon: 21.22 })).toBe(1112);
    expect(distanceMeters({ lat: 45.75, lon: 21.22 }, { lat: 45.75, lon: 21.22 })).toBe(0);
  });
});
