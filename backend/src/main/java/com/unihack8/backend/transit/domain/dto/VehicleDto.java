package com.unihack8.backend.transit.domain.dto;

import java.time.Instant;

/** One live vehicle on the map. */
public record VehicleDto(String id, double lat, double lon, Double bearing, Double speedKmh, String headsign,
                         String nextStop, Boolean accessible, Instant reportedAt) {
}
