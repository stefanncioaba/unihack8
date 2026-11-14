// Transit (STPT) shapes. Source of truth: docs/API.md -> Transit.

export type TransitDeparture = { route: string; headsign: string; lastDepartureAt: string };

export type TransitSummary = {
  nearestStop: { id: string; name: string; distanceMeters: number } | null;
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

/** One live vehicle. `route` is the line id (same as TransitRoute.id), `routeName` the name to show; `type` and
 * `color` are null when the line is not in STPT's line list, `route` / `routeName` when STPT gave no line. */
export type TransitVehicle = {
  id: string;
  route: string | null;
  routeName: string | null;
  type: TransitRouteType | null;
  color: string | null;
  lat: number;
  lon: number;
  bearing: number | null;
  speedKmh: number | null;
  headsign: string | null;
  nextStop: string | null;
  accessible: boolean;
  reportedAt: string;
};

/** Live vehicles of one line, or of every line when `route` is null (`stale` = STPT did not answer, last cached value). */
export type TransitVehicles = { route: string | null; updatedAt: string; stale: boolean; vehicles: TransitVehicle[] };

/** The drawn path of one line: one Google encoded polyline (precision 5) per direction / variant. */
export type TransitShape = { route: string; routeName: string; type: TransitRouteType; color: string | null; polylines: string[] };

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
