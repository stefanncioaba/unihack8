package com.unihack8.backend.routing.domain.model;

import com.unihack8.backend.common.exception.ApiException;
import com.unihack8.backend.common.exception.ErrorCode;

/** A position on the map, in degrees. */
public record GeoPoint(double lat, double lon) {

    private static final double EARTH_RADIUS_METERS = 6_371_000;

    // Parses "lat,lon" (e.g. "45.7537,21.2257"); 400 VALIDATION_FAILED when malformed or out of range.
    public static GeoPoint parse(String name, String value) {
        String[] parts = value == null ? new String[0] : value.split(",");
        if (parts.length != 2) {
            throw invalid(name);
        }
        double lat;
        double lon;
        try {
            lat = Double.parseDouble(parts[0].trim());
            lon = Double.parseDouble(parts[1].trim());
        } catch (NumberFormatException e) {
            throw invalid(name);
        }
        if (!Double.isFinite(lat) || !Double.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
            throw invalid(name);
        }
        return new GeoPoint(lat, lon);
    }

    // Great-circle (straight-line) distance to another point, in meters (haversine formula).
    public double distanceMetersTo(GeoPoint other) {
        double dLat = Math.toRadians(other.lat - lat);
        double dLon = Math.toRadians(other.lon - lon);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                + Math.cos(Math.toRadians(lat)) * Math.cos(Math.toRadians(other.lat))
                * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(a)));
    }

    // Standard error for a bad coordinate parameter.
    private static ApiException invalid(String name) {
        return new ApiException(ErrorCode.VALIDATION_FAILED,
                "'" + name + "' must be 'lat,lon' with lat in [-90, 90] and lon in [-180, 180].");
    }
}
