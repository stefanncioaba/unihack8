package com.unihack8.backend.transit.domain.model;

import com.unihack8.backend.common.geo.GeoPoint;
import java.util.List;

/**
 * One drawn path (direction / variant) of a line, taken from one representative GTFS trip.
 *
 * @param points      ordered points of the path
 * @param directionId GTFS direction_id (0 or 1), null when the feed has none
 * @param headsign    where it is heading (trip_headsign, or the last stop's name), may be null
 * @param stops       the trip's stops in order (empty when unknown)
 */
public record ShapePath(List<GeoPoint> points, Integer directionId, String headsign, List<ShapeStop> stops) {
}
