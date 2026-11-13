package com.unihack8.backend.transit.domain.dto;

import java.util.List;

/** GET /transit/stops item. */
public record TransitStopDto(String id, String name, double lat, double lon, List<String> routes) {
}
