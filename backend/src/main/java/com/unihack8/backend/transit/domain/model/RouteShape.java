package com.unihack8.backend.transit.domain.model;

import com.unihack8.backend.common.geo.GeoPoint;
import java.util.List;

/**
 * The drawn paths of one line from the GTFS timetable.
 *
 * @param routeName line name as passengers know it, e.g. "1" (same id as GET /transit/routes)
 * @param routeType GTFS route_type ("0" tram, "3" bus, "11" trolleybus, ...), may be null
 * @param color     GTFS route_color without '#', may be null
 * @param paths     one path per distinct direction/variant, with its direction, headsign and stops
 */
public record RouteShape(String routeName, String routeType, String color, List<ShapePath> paths) {

    // Only the point lists of every path, in order.
    public List<List<GeoPoint>> points() {
        return paths.stream().map(ShapePath::points).toList();
    }
}
