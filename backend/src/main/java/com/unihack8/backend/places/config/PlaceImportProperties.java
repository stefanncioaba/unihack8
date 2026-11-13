package com.unihack8.backend.places.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Settings of the OpenStreetMap places import (prefix "places.import").
 *
 * @param enabled     run the import once at startup (default false)
 * @param overpassUrl Overpass API endpoints, comma-separated, tried in order (the first one that answers wins)
 * @param bbox        area to import as "south,west,north,east" (default: Timisoara)
 */
@ConfigurationProperties(prefix = "places.import")
public record PlaceImportProperties(Boolean enabled, String overpassUrl, String bbox) {

    // Main public server, then a public mirror for when it is "at capacity".
    public static final String DEFAULT_OVERPASS_URL =
            "https://overpass-api.de/api/interpreter,https://overpass.kumi.systems/api/interpreter";
    public static final String DEFAULT_BBOX = "45.69,21.14,45.81,21.31";

    // Fills in defaults for values not set in the properties.
    public PlaceImportProperties {
        enabled = enabled != null && enabled;
        overpassUrl = overpassUrl == null || overpassUrl.isBlank() ? DEFAULT_OVERPASS_URL : overpassUrl.trim();
        bbox = bbox == null || bbox.isBlank() ? DEFAULT_BBOX : bbox.replace(" ", "");
    }

    // The configured endpoints as a list, in the order they are tried.
    public java.util.List<String> overpassUrls() {
        return java.util.Arrays.stream(overpassUrl.split(","))
                .map(String::trim)
                .filter(url -> !url.isEmpty())
                .toList();
    }

    // Properties with every default (used by tests).
    public static PlaceImportProperties defaults() {
        return new PlaceImportProperties(null, null, null);
    }
}
