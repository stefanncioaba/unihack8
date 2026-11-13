package com.unihack8.backend.routing.util;

import com.unihack8.backend.common.geo.GeoPoint;
import java.util.ArrayList;
import java.util.List;

/** Google encoded polyline format (precision 5), the same format OpenTripPlanner returns. */
public final class PolylineEncoder {

    // Utility class.
    private PolylineEncoder() {
    }

    // Encodes points into a polyline string.
    public static String encode(List<GeoPoint> points) {
        StringBuilder out = new StringBuilder();
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

    // Decodes a polyline string back into points.
    public static List<GeoPoint> decode(String polyline) {
        List<GeoPoint> points = new ArrayList<>();
        int[] index = {0};
        long lat = 0;
        long lon = 0;
        while (index[0] < polyline.length()) {
            lat += decodeValue(polyline, index);
            lon += decodeValue(polyline, index);
            points.add(new GeoPoint(lat / 1e5, lon / 1e5));
        }
        return points;
    }

    // Appends one signed delta as 5-bit chunks.
    private static void encodeValue(long value, StringBuilder out) {
        long v = value < 0 ? ~(value << 1) : value << 1;
        while (v >= 0x20) {
            out.append((char) ((0x20 | (v & 0x1f)) + 63));
            v >>= 5;
        }
        out.append((char) (v + 63));
    }

    // Reads one signed delta starting at index[0] and moves index[0] past it.
    private static long decodeValue(String s, int[] index) {
        long result = 0;
        int shift = 0;
        int b;
        do {
            b = s.charAt(index[0]++) - 63;
            result |= (long) (b & 0x1f) << shift;
            shift += 5;
        } while (b >= 0x20);
        return (result & 1) != 0 ? ~(result >> 1) : result >> 1;
    }
}
