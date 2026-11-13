package com.unihack8.backend.transit.domain.dto;

import java.time.Instant;
import java.util.List;

/** GET /transit/vehicles answer; stale = STPT failed and this is the last cached value. */
public record VehiclesResponse(String route, Instant updatedAt, boolean stale, List<VehicleDto> vehicles) {
}
