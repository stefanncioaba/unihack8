package com.unihack8.backend.transit.domain.dto;

import java.util.List;

/** GET /transit/summary answer: the home page transit line, message ready to show. */
public record TransitSummaryResponse(NearestStopDto nearestStop, List<LastDepartureDto> lastDepartures,
                                     int activeAlerts, String message) {
}
