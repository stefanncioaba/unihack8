package com.unihack8.backend.eventimport.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Settings of the LiveTickets events import (prefix "events.import", PLAN task 7).
 *
 * @param enabled        run the import once at startup (default false)
 * @param liveticketsUrl LiveTickets public event search endpoint
 * @param city           only events in this city are imported (compared without diacritics)
 * @param nominatimUrl   OpenStreetMap Nominatim search endpoint used to locate venues
 * @param bbox           area venues must lie in, "south,west,north,east" (default: Timișoara with its
 *                       airport and the Expovest/Ghiroda edge)
 */
@ConfigurationProperties(prefix = "events.import")
public record EventImportProperties(Boolean enabled, String liveticketsUrl, String city,
                                    String nominatimUrl, String bbox) {

    public static final String DEFAULT_LIVETICKETS_URL = "https://api.livetickets.ro/public/event-search";
    public static final String DEFAULT_CITY = "Timișoara";
    public static final String DEFAULT_NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
    public static final String DEFAULT_BBOX = "45.65,21.10,45.85,21.40";

    // Fills in defaults for values not set in the properties.
    public EventImportProperties {
        enabled = enabled != null && enabled;
        liveticketsUrl = blank(liveticketsUrl) ? DEFAULT_LIVETICKETS_URL : liveticketsUrl.trim();
        city = blank(city) ? DEFAULT_CITY : city.trim();
        nominatimUrl = blank(nominatimUrl) ? DEFAULT_NOMINATIM_URL : nominatimUrl.trim();
        bbox = blank(bbox) ? DEFAULT_BBOX : bbox.replace(" ", "");
    }

    // Properties with every default (used by tests).
    public static EventImportProperties defaults() {
        return new EventImportProperties(null, null, null, null, null);
    }

    // True for null or whitespace-only values.
    private static boolean blank(String value) {
        return value == null || value.isBlank();
    }
}
