package com.unihack8.backend.places.domain;

import com.unihack8.backend.places.domain.entity.Place;
import java.util.Map;

/**
 * A place read from one OpenStreetMap element, ready to be stored (PLAN 8.2).
 *
 * @param osmId        "type/id", e.g. "node/380526548"
 * @param name         display name
 * @param category     app category
 * @param lat          latitude
 * @param lon          longitude
 * @param address      "street number", or null
 * @param openingHours raw opening_hours tag, or null
 * @param tags         all OpenStreetMap tags
 */
public record OsmPlaceData(String osmId, String name, PlaceCategory category, double lat, double lon,
                           String address, String openingHours, Map<String, String> tags) {

    // Copies these values onto a Place row (new or existing).
    public void applyTo(Place place) {
        place.update(name, category, lat, lon, address, openingHours, tags);
    }
}
