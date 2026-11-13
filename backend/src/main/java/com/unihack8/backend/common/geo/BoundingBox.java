package com.unihack8.backend.common.geo;

import com.unihack8.backend.common.exception.ApiException;
import com.unihack8.backend.common.exception.ErrorCode;

/**
 * Map viewport. Parses the API's {@code bbox=minLon,minLat,maxLon,maxLat} format
 * (docs/API.md -> Conventions).
 */
public record BoundingBox(double minLon, double minLat, double maxLon, double maxLat) {

    /** Parses "minLon,minLat,maxLon,maxLat"; 400 VALIDATION_FAILED naming the parameter when bad. */
    public static BoundingBox parse(String value, String parameterName) {
        double[] n = GeoParsing.numbers(value, 4, parameterName, "minLon,minLat,maxLon,maxLat");
        if (n[0] < -180 || n[2] > 180 || n[1] < -90 || n[3] > 90) {
            throw new ApiException(ErrorCode.VALIDATION_FAILED, parameterName + " is outside valid coordinates.");
        }
        if (n[0] > n[2] || n[1] > n[3]) {
            throw new ApiException(ErrorCode.VALIDATION_FAILED,
                    parameterName + " must be minLon,minLat,maxLon,maxLat with min <= max.");
        }
        return new BoundingBox(n[0], n[1], n[2], n[3]);
    }

    // True when the point lies inside the box (edges included).
    public boolean contains(double lat, double lon) {
        return lat >= minLat && lat <= maxLat && lon >= minLon && lon <= maxLon;
    }
}
