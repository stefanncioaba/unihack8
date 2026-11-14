package com.unihack8.backend.transit.domain.model;

/**
 * A stop along a drawn path (GTFS stops.txt).
 *
 * @param id   GTFS stop_id (same id as GET /transit/stops)
 * @param name stop name, may be null
 * @param lat  latitude
 * @param lon  longitude
 */
public record ShapeStop(String id, String name, double lat, double lon) {
}
