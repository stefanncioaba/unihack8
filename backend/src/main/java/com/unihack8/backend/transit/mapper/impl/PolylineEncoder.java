package com.unihack8.backend.transit.mapper.impl;

import com.unihack8.backend.common.geo.GeoPoint;
import java.util.List;

/**
 * Google encoded polyline format, precision 5 (what frontend/src/lib/polyline.ts decodes).
 * https://developers.google.com/maps/documentation/utilities/polylinealgorithm
 */
public final class PolylineEncoder {

    // Utility class.
    private PolylineEncoder() {
    }

    // Encodes points as deltas of lat/lon rounded to 1e-5 degrees.
    public static String encode(List<GeoPoint> points) {
        StringBuilder out = new StringBuilder(points.size() * 8);
        long prevLat = 0;
        long prevLon = 0;
        for (GeoPoint p : points) {
            long lat = Math.round(p.lat() * 1e5);
            long lon = Math.round(p.lon() * 1e5);
            encodeValue(lat - prevLat, out);
            encodeValue(lon - prevLon, out);
            prevLat = lat;
            prevLon = lon;
        }
        return out.toString();
    }

    // One signed value: zig-zag, then 5-bit chunks with a continuation bit, offset by 63.
    private static void encodeValue(long value, StringBuilder out) {
        long v = value < 0 ? ~(value << 1) : value << 1;
        while (v >= 0x20) {
            out.append((char) ((0x20 | (v & 0x1f)) + 63));
            v >>= 5;
        }
        out.append((char) (v + 63));
    }
}
