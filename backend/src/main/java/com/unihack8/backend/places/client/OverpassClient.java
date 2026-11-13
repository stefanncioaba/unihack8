package com.unihack8.backend.places.client;

import com.unihack8.backend.places.client.dto.OverpassResponse;

/** Downloads places from the OpenStreetMap Overpass API (PLAN 8.2). Used only by the import, never per user request. */
public interface OverpassClient {

    // Runs one query for every app category inside the configured area and returns the raw elements.
    OverpassResponse fetchPlaces();
}
