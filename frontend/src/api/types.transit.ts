// Transit (STPT) shapes. Source of truth: docs/API.md -> Transit.

export type TransitDeparture = { route: string; headsign: string; lastDepartureAt: string };

export type TransitSummary = {
  nearestStop: { id: string; name: string; distanceMeters: number } | null;
  lastDepartures: TransitDeparture[];
  activeAlerts: number;
  message: string;
};

export type TransitAlert = { id: string; title: string; description: string | null };
