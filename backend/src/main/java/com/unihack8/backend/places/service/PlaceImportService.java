package com.unihack8.backend.places.service;

import com.unihack8.backend.places.client.dto.OverpassElement;
import java.util.List;

/** Imports OpenStreetMap places into the places table (PLAN 8.2). Safe to run again: it upserts by osmId. */
public interface PlaceImportService {

    // Downloads places from Overpass and stores them.
    Result importPlaces();

    // Stores already-downloaded elements: inserts new ones, updates known ones, removes vanished ones.
    Result importElements(List<OverpassElement> elements);

    /**
     * What one import run did.
     *
     * @param fetched  elements Overpass returned
     * @param inserted new places stored
     * @param updated  existing places refreshed
     * @param skipped  elements ignored (no position, no category, no name, or duplicate)
     * @param removed  places deleted because they are no longer in OpenStreetMap
     */
    record Result(int fetched, int inserted, int updated, int skipped, int removed) {
    }
}
