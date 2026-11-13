package com.unihack8.backend.places.client.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.util.Map;

/**
 * One OpenStreetMap element from Overpass ("out center tags").
 *
 * @param type   "node", "way" or "relation"
 * @param id     OpenStreetMap id, unique per type
 * @param lat    latitude (nodes only)
 * @param lon    longitude (nodes only)
 * @param center centre point (ways and relations only)
 * @param tags   OpenStreetMap tags, e.g. amenity=restaurant, name=...
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record OverpassElement(String type, long id, Double lat, Double lon, Center center,
                              Map<String, String> tags) {

    // Never-null tags, so callers can look up keys without checks.
    public OverpassElement {
        tags = tags == null ? Map.of() : tags;
    }

    /** Centre point Overpass computes for ways and relations. */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Center(Double lat, Double lon) {
    }
}
