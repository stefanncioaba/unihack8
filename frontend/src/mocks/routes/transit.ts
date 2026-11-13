// Mock routes: transit. Shapes follow docs/API.md.
import type { TransitSummary } from '@/api/types.transit';

import { getState, type Route } from '../core';

export const transitRoutes: Route[] = [
  {
    method: 'GET',
    pattern: /^\/transit\/summary$/,
    handler: (): TransitSummary => ({
      nearestStop: { id: '1', name: 'Dâmbovița (Ion Barac)', distanceMeters: 230 },
      lastDepartures: [{ route: '2', headsign: 'Shopping City', lastDepartureAt: '2026-11-14T21:41:00Z' }],
      activeAlerts: getState().alerts.length,
      message: 'Last tram 2 from Dâmbovița (Ion Barac) leaves at 23:41',
    }),
  },
  { method: 'GET', pattern: /^\/transit\/alerts$/, handler: () => getState().alerts },
];
