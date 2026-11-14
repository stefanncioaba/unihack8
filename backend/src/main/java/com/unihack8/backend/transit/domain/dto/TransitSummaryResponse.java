package com.unihack8.backend.transit.domain.dto;

import java.util.List;

/**
 * GET /transit/summary answer: the home page transit line, message ready to show.
 * nextArrival is null when no arrival is known at the nearest stop (or STPT is down).
 */
public record TransitSummaryResponse(NearestStopDto nearestStop, NextArrivalDto nextArrival,
                                     List<LastDepartureDto> lastDepartures, int activeAlerts, String message) {
}
