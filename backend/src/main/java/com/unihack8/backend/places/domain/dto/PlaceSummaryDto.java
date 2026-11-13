package com.unihack8.backend.places.domain.dto;

import java.util.UUID;

/**
 * Place in lists and on the map (docs/API.md -> PlaceSummary).
 *
 * @param distanceMeters distance from the request's {@code near} point, null when not given
 */
public record PlaceSummaryDto(
        UUID id,
        String osmId,
        String name,
        String category,
        double lat,
        double lon,
        String address,
        Integer distanceMeters) {
}
