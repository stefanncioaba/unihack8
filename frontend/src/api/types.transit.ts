// Transit (STPT) shapes. Source of truth: docs/API.md -> Transit.

export type TransitDeparture = { route: string; headsign: string; lastDepartureAt: string };

/** Soonest arrival at the nearest stop; `last` = no later trip of this line today (timetable). */
export type NextArrival = { route: string; headsign: string; arrivesAt: string; minutes: number; live: boolean; last: boolean };

export type TransitSummary = {
  nearestStop: { id: string; name: string; distanceMeters: number } | null;
  /** null when no arrival is known (then `message` falls back to the last departure). */
  nextArrival: NextArrival | null;
  lastDepartures: TransitDeparture[];
  activeAlerts: number;
  message: string;
};

export type TransitAlert = { id: string; title: string; description: string | null };

/** Line type as STPT reports it (docs/API.md -> GET /transit/routes). */
export type TransitRouteType = 'TRAM' | 'TROLLEYBUS' | 'BUS' | 'EXPRESS' | 'METROPOLITAN' | 'BOAT';

/** One line. `color` is STPT's line colour (null when STPT has none). */
export type TransitRoute = { id: string; type: TransitRouteType; name: string; from: string | null; to: string | null; color: string | null };

/** One stop with the lines that serve it. */
export type TransitStop = { id: string; name: string; lat: number; lon: number; routes: string[] };

/** One live vehicle of a line. */
export type TransitVehicle = {
  id: string;
  lat: number;
  lon: number;
  bearing: number | null;
  speedKmh: number | null;
  headsign: string | null;
  nextStop: string | null;
  accessible: boolean;
  reportedAt: string;
};

/** Live vehicles of one line (`stale` = STPT did not answer, last cached value). */
export type TransitVehicles = { route: string; updatedAt: string; stale: boolean; vehicles: TransitVehicle[] };

/** One upcoming arrival at a stop (`live: false` = from the timetable). */
export type TransitArrival = { route: string; headsign: string; arrivesAt: string; minutes: number; live: boolean };

/** Next arrivals at a stop, soonest first. */
export type StopArrivals = { stopId: string; stopName: string | null; updatedAt: string; stale: boolean; arrivals: TransitArrival[] };

/** Last departure of each line and direction today (PLAN 9.6). */
export type LastDepartures = {
  stopId: string;
  stopName: string | null;
  source: 'TIMETABLE' | 'LIVE_ESTIMATE';
  departures: TransitDeparture[];
};
