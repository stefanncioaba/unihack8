package com.unihack8.backend.transit.domain.model;

import com.unihack8.backend.common.geo.GeoPoint;
import java.util.List;

/**
 * The drawn path of one line from the GTFS timetable.
 *
 * @param routeName line name as passengers know it, e.g. "1" (same id as GET /transit/routes)
 * @param routeType GTFS route_type ("0" tram, "3" bus, "11" trolleybus, ...), may be null
 * @param color     GTFS route_color without '#', may be null
 * @param paths     one ordered point list per distinct direction/variant
 */
public record RouteShape(String routeName, String routeType, String color, List<List<GeoPoint>> paths) {
}
