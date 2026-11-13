package com.unihack8.backend.transit.domain.dto;

import java.time.Instant;

/** Last known departure of one line (and direction) from a stop. */
public record LastDepartureDto(String route, String headsign, Instant lastDepartureAt) {
}
