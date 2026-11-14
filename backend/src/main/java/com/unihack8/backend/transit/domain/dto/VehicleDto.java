package com.unihack8.backend.transit.domain.dto;

import java.time.Instant;

/**
 * One live vehicle on the map.
 *
 * @param route     line id, same as GET /transit/routes id (null when STPT did not say)
 * @param routeName line name to show, e.g. "1", "E2"
 * @param type      TRAM, TROLLEYBUS, BUS, EXPRESS, METROPOLITAN or BOAT (null when the line is unknown)
 * @param color     line colour, e.g. "#e3a900" (null when unknown)
 */
public record VehicleDto(String id, String route, String routeName, String type, String color, double lat,
                         double lon, Double bearing, Double speedKmh, String headsign, String nextStop,
                         Boolean accessible, Instant reportedAt) {
}
