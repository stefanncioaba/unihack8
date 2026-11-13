package com.unihack8.backend.transit.domain.dto;

import java.time.Instant;

/** One upcoming arrival; live = from a tracked vehicle, not the timetable. */
public record ArrivalDto(String route, String headsign, Instant arrivesAt, int minutes, boolean live) {
}
