package com.unihack8.backend.transit.domain.dto;

import java.time.Instant;

/**
 * Soonest arrival at the caller's nearest stop (home page). last = no later trip of this line
 * and direction today, per the GTFS timetable (never set from the live-only estimate).
 */
public record NextArrivalDto(String route, String headsign, Instant arrivesAt, int minutes, boolean live,
                             boolean last) {
}
