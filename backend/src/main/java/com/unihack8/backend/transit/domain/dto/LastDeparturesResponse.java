package com.unihack8.backend.transit.domain.dto;

import java.util.List;

/** GET /transit/last-departures answer; source is TIMETABLE or LIVE_ESTIMATE. */
public record LastDeparturesResponse(String stopId, String stopName, String source,
                                     List<LastDepartureDto> departures) {
}
