package com.unihack8.backend.transit.domain.dto;

import java.time.Instant;
import java.util.List;

/** GET /transit/stops/{id}/arrivals answer, sorted by arrival time. */
public record ArrivalsResponse(String stopId, String stopName, Instant updatedAt, boolean stale,
                               List<ArrivalDto> arrivals) {
}
