package com.unihack8.backend.common.geo;

import com.unihack8.backend.common.exception.ApiException;
import com.unihack8.backend.common.exception.ErrorCode;

/**
 * A latitude/longitude pair. Parses the API's {@code near=lat,lon} format (docs/API.md -> Conventions).
 */
public record GeoPoint(double lat, double lon) {

    private static final double EARTH_RADIUS_METERS = 6_371_000;

    // Checks the coordinates are on Earth.
    public GeoPoint {
        if (lat < -90 || lat > 90 || lon < -180 || lon > 180 || Double.isNaN(lat) || Double.isNaN(lon)) {
            throw new IllegalArgumentException("Coordinates out of range: " + lat + "," + lon);
        }
    }

    /** Parses "lat,lon"; 400 VALIDATION_FAILED naming the parameter when the value is bad. */
    public static GeoPoint parse(String value, String parameterName) {
        double[] numbers = GeoParsing.numbers(value, 2, parameterName, "lat,lon");
        try {
            return new GeoPoint(numbers[0], numbers[1]);
        } catch (IllegalArgumentException e) {
            throw new ApiException(ErrorCode.VALIDATION_FAILED, parameterName + " is outside valid coordinates.");
        }
    }

    // Great-circle (haversine) distance to another point, in meters.
    public double distanceMetersTo(GeoPoint other) {
        double dLat = Math.toRadians(other.lat - lat);
        double dLon = Math.toRadians(other.lon - lon);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                + Math.cos(Math.toRadians(lat)) * Math.cos(Math.toRadians(other.lat))
                * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(a)));
    }

    // Smallest box that contains every point within the given radius (cheap pre-filter for "near").
    public BoundingBox boxAround(double radiusMeters) {
        double latDelta = Math.toDegrees(radiusMeters / EARTH_RADIUS_METERS);
        double lonDelta = Math.toDegrees(radiusMeters / (EARTH_RADIUS_METERS * Math.cos(Math.toRadians(lat))));
        return new BoundingBox(
                Math.max(-180, lon - lonDelta), Math.max(-90, lat - latDelta),
                Math.min(180, lon + lonDelta), Math.min(90, lat + latDelta));
    }
}
