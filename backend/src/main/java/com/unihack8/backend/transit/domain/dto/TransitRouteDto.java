package com.unihack8.backend.transit.domain.dto;

/**
 * GET /transit/routes item.
 *
 * @param type  TRAM, TROLLEYBUS, BUS, EXPRESS, METROPOLITAN or BOAT
 * @param color line colour for the map, e.g. "#e3a900" (null when STPT has none)
 */
public record TransitRouteDto(String id, String type, String name, String from, String to, String color) {
}
