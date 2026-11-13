package com.unihack8.backend.common.geo;

import com.unihack8.backend.common.exception.ApiException;
import com.unihack8.backend.common.exception.ErrorCode;

/**
 * A position on the map. Parses the {@code near=lat,lon} query format from docs/API.md.
 */
public record GeoPoint(double lat, double lon) {

    private static final double EARTH_RADIUS_METERS = 6_371_000;

    // Parses "lat,lon"; answers 400 VALIDATION_FAILED when the text is not two valid coordinates.
    public static GeoPoint parse(String text, String paramName) {
        if (text == null || text.isBlank()) {
            throw new ApiException(ErrorCode.VALIDATION_FAILED, paramName + " is required, as lat,lon.");
        }
        String[] parts = text.split(",");
        if (parts.length != 2) {
            throw new ApiException(ErrorCode.VALIDATION_FAILED, paramName + " must be lat,lon.");
        }
        try {
            double lat = Double.parseDouble(parts[0].trim());
            double lon = Double.parseDouble(parts[1].trim());
            if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
                throw new ApiException(ErrorCode.VALIDATION_FAILED, paramName + " is outside the map.");
            }
            return new GeoPoint(lat, lon);
        } catch (NumberFormatException e) {
            throw new ApiException(ErrorCode.VALIDATION_FAILED, paramName + " must be lat,lon numbers.");
        }
    }

    // Great-circle (haversine) distance in meters to another point.
    public double distanceMeters(double otherLat, double otherLon) {
        double dLat = Math.toRadians(otherLat - lat);
        double dLon = Math.toRadians(otherLon - lon);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                + Math.cos(Math.toRadians(lat)) * Math.cos(Math.toRadians(otherLat))
                * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(a));
    }
}
