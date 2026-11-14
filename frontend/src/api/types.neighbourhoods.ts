// Types for GET /neighbourhoods/pulse (docs/API.md -> Neighbourhoods).
import type { EventCategory } from './types';
import type { TransitAlert } from './types.transit';

export type PulseLevel = 'QUIET' | 'STEADY' | 'BUSY';

/** An event on an area card; `happeningNow` false means later tonight. */
export type PulseEvent = {
  id: string;
  title: string;
  category: EventCategory | string;
  venueName: string;
  startsAt: string;
  endsAt: string | null;
  capacity: number | null;
  spotsLeft: number | null;
  imageUrl: string | null;
  happeningNow: boolean;
};

export type PulseEvents = { nowCount: number; tonightCount: number; freeSpots: number; highlights: PulseEvent[] };

/** `available` false when STPT could not be reached. */
export type PulseTransit = { available: boolean; lines: string[]; stopCount: number; liveVehicles: number; alerts: TransitAlert[] };

export type PulsePlaces = { total: number; openNow: number; topCategories: string[] };

export type PulsePeople = { going: number; reliableGoing: number };

/** One live area card. */
export type NeighbourhoodPulse = {
  id: string;
  name: string;
  lat: number;
  lon: number;
  radiusMeters: number;
  level: PulseLevel;
  score: number;
  events: PulseEvents;
  transit: PulseTransit;
  places: PulsePlaces;
  people: PulsePeople;
};

/** Every area, busiest first. */
export type NeighbourhoodPulseResponse = { generatedAt: string; areas: NeighbourhoodPulse[] };
