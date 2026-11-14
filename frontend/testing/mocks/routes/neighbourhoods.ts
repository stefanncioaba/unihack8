// Mock routes: Neighbourhood Pulse. Shape follows docs/API.md -> Neighbourhoods.
import type { NeighbourhoodPulse, NeighbourhoodPulseResponse } from '@/api/types.neighbourhoods';

import type { Route } from '../core';

/** Fixed area cards: one busy with an event and an alert, one with STPT down, one quiet. */
export function mockPulseAreas(): NeighbourhoodPulse[] {
  return [
    {
      id: 'cetate',
      name: 'Cetate',
      lat: 45.7568,
      lon: 21.229,
      radiusMeters: 750,
      level: 'BUSY',
      score: 21,
      events: {
        nowCount: 1,
        tonightCount: 2,
        freeSpots: 6,
        highlights: [
          {
            id: 'e0000000-0000-4000-8000-000000000001',
            title: 'Board games night',
            category: 'GAMES',
            venueName: 'Scârț Loc Lejer',
            startsAt: '2026-11-14T17:00:00Z',
            endsAt: '2026-11-14T21:00:00Z',
            capacity: 12,
            spotsLeft: 4,
            imageUrl: null,
            happeningNow: true,
          },
          {
            id: 'e0000000-0000-4000-8000-000000000004',
            title: 'Indie rock night',
            category: 'CONCERT',
            venueName: 'Form Space',
            startsAt: '2026-11-14T19:30:00Z',
            endsAt: null,
            capacity: null,
            spotsLeft: null,
            imageUrl: null,
            happeningNow: false,
          },
        ],
      },
      transit: {
        available: true,
        lines: ['1', '2', '8', 'E2'],
        stopCount: 5,
        liveVehicles: 3,
        alerts: [{ id: 'a1', title: 'Line 8 diverted', description: 'Linia 8 circulă deviat' }],
      },
      places: { total: 120, openNow: 64, topCategories: ['restaurant', 'cafe'] },
      people: { going: 9, reliableGoing: 7 },
    },
    {
      id: 'fabric',
      name: 'Fabric',
      lat: 45.7585,
      lon: 21.2475,
      radiusMeters: 900,
      level: 'STEADY',
      score: 8,
      events: { nowCount: 0, tonightCount: 1, freeSpots: 0, highlights: [] },
      transit: { available: false, lines: [], stopCount: 0, liveVehicles: 0, alerts: [] },
      places: { total: 40, openNow: 12, topCategories: ['bar'] },
      people: { going: 0, reliableGoing: 0 },
    },
    {
      id: 'somewhere-new',
      name: 'Somewhere new',
      lat: 45.7,
      lon: 21.2,
      radiusMeters: 500,
      level: 'QUIET',
      score: 0,
      events: { nowCount: 0, tonightCount: 0, freeSpots: 0, highlights: [] },
      transit: { available: true, lines: [], stopCount: 0, liveVehicles: 0, alerts: [] },
      places: { total: 0, openNow: 0, topCategories: [] },
      people: { going: 0, reliableGoing: 0 },
    },
  ];
}

export const neighbourhoodsRoutes: Route[] = [
  {
    method: 'GET',
    pattern: /^\/neighbourhoods\/pulse$/,
    handler: (): NeighbourhoodPulseResponse => ({ generatedAt: new Date().toISOString(), areas: mockPulseAreas() }),
  },
];
