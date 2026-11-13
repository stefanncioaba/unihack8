package com.unihack8.backend.places.domain.dto;

import com.unihack8.backend.common.geo.BoundingBox;
import com.unihack8.backend.common.geo.GeoPoint;
import com.unihack8.backend.places.domain.PlaceCategory;
import java.util.Set;

/**
 * Validated filters for GET /places. Every field is optional except radiusMeters, which is only
 * used together with near.
 *
 * @param categories   wanted categories; empty = all
 * @param bbox         map viewport, or null
 * @param near         point to measure distance from (results sorted by distance), or null
 * @param radiusMeters max distance from near, in meters
 * @param query        part of the name to search for, or null
 */
public record PlaceSearchCriteria(
        Set<PlaceCategory> categories,
        BoundingBox bbox,
        GeoPoint near,
        int radiusMeters,
        String query) {

    public static final int DEFAULT_RADIUS_METERS = 1500;
    public static final int MAX_RADIUS_METERS = 10_000;

    // Normalises null categories to an empty set and blank queries to null.
    public PlaceSearchCriteria {
        categories = categories == null ? Set.of() : Set.copyOf(categories);
        query = query == null || query.isBlank() ? null : query.trim();
    }
}
