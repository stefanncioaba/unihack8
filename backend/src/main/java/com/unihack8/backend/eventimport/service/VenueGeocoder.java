package com.unihack8.backend.eventimport.service;

import com.unihack8.backend.common.geo.GeoPoint;
import java.util.Optional;

/**
 * Turns a venue name (e.g. "Fratelli Lounge &amp; Club Timisoara") into map coordinates (PLAN 7.3).
 * Empty when the venue cannot be located in the import area; such events are stored without
 * coordinates and appear in lists but not on the map.
 */
public interface VenueGeocoder {

    // Coordinates of the venue inside the import area, or empty.
    Optional<GeoPoint> locate(String venueName);
}
