package com.unihack8.backend.common.geo;

import com.unihack8.backend.common.exception.ApiException;
import com.unihack8.backend.common.exception.ErrorCode;

/**
 * Map viewport from the {@code bbox=minLon,minLat,maxLon,maxLat} query format (docs/API.md).
 */
public record BoundingBox(double minLon, double minLat, double maxLon, double maxLat) {

    // Parses "minLon,minLat,maxLon,maxLat"; null or blank means "no filter" and returns null.
    public static BoundingBox parseOptional(String text) {
        if (text == null || text.isBlank()) {
            return null;
        }
        String[] parts = text.split(",");
        if (parts.length != 4) {
            throw new ApiException(ErrorCode.VALIDATION_FAILED, "bbox must be minLon,minLat,maxLon,maxLat.");
        }
        try {
            BoundingBox box = new BoundingBox(
                    Double.parseDouble(parts[0].trim()), Double.parseDouble(parts[1].trim()),
                    Double.parseDouble(parts[2].trim()), Double.parseDouble(parts[3].trim()));
            if (box.minLon > box.maxLon || box.minLat > box.maxLat) {
                throw new ApiException(ErrorCode.VALIDATION_FAILED, "bbox minimums must not exceed maximums.");
            }
            return box;
        } catch (NumberFormatException e) {
            throw new ApiException(ErrorCode.VALIDATION_FAILED, "bbox must contain four numbers.");
        }
    }

    // True when the point lies inside the box (edges included).
    public boolean contains(double lat, double lon) {
        return lat >= minLat && lat <= maxLat && lon >= minLon && lon <= maxLon;
    }
}
