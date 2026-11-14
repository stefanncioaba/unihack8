package com.unihack8.backend.transit.domain.dto;

/**
 * A stop along one direction of a line (GET /transit/shapes?route=).
 *
 * @param id   stop id, same as GET /transit/stops id
 * @param name stop name, may be null
 * @param lat  latitude
 * @param lon  longitude
 */
public record ShapeStopDto(String id, String name, double lat, double lon) {
}
