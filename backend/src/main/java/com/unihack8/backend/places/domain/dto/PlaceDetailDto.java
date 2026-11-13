package com.unihack8.backend.places.domain.dto;

import java.util.Map;
import java.util.UUID;

/**
 * One place with its details (docs/API.md -> GET /places/{id}).
 *
 * @param openingHours raw OpenStreetMap opening_hours text, or null
 * @param tags         the useful extra OpenStreetMap tags that are present (cuisine, website, phone...)
 */
public record PlaceDetailDto(
        UUID id,
        String osmId,
        String name,
        String category,
        double lat,
        double lon,
        String address,
        String openingHours,
        Map<String, String> tags) {
}
