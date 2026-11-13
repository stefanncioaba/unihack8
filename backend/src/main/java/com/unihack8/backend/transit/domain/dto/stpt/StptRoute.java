package com.unihack8.backend.transit.domain.dto.stpt;

/**
 * One line from /gtfs-data/route-manifest.json.
 *
 * @param category  STPT's grouping: tram, trolleybus, urban, express, scolar, metropolitan, vaporetto, other
 * @param routeType GTFS route_type ("0" tram, "3" bus, "4" boat, "11" trolleybus)
 * @param longName  "First end - Other end"
 * @param color     hex without '#', e.g. "e3a900"
 */
public record StptRoute(String shortName, String longName, String routeType, String category, String color) {
}
