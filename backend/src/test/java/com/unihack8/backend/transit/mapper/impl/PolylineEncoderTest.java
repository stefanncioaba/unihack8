package com.unihack8.backend.transit.mapper.impl;

import static org.assertj.core.api.Assertions.assertThat;

import com.unihack8.backend.common.geo.GeoPoint;
import java.util.List;
import org.junit.jupiter.api.Test;

/** Google encoded polyline output (the format frontend/src/lib/polyline.ts decodes). */
class PolylineEncoderTest {

    // Google's documented example path.
    @Test
    void googleExample() {
        assertThat(PolylineEncoder.encode(List.of(new GeoPoint(38.5, -120.2), new GeoPoint(40.7, -120.95),
                new GeoPoint(43.252, -126.453)))).isEqualTo("_p~iF~ps|U_ulLnnqC_mqNvxq`@");
    }

    // No points, no text; a point at the origin is "??".
    @Test
    void edgeCases() {
        assertThat(PolylineEncoder.encode(List.of())).isEmpty();
        assertThat(PolylineEncoder.encode(List.of(new GeoPoint(0, 0)))).isEqualTo("??");
    }

    // Decoding our own output gives back the points rounded to 5 decimals.
    @Test
    void roundTrip() {
        List<GeoPoint> points = List.of(new GeoPoint(45.753712, 21.225741), new GeoPoint(45.748911, 21.231802));
        List<double[]> decoded = decode(PolylineEncoder.encode(points));
        assertThat(decoded).hasSize(2);
        assertThat(decoded.get(0)[0]).isEqualTo(45.75371);
        assertThat(decoded.get(0)[1]).isEqualTo(21.22574);
        assertThat(decoded.get(1)[0]).isEqualTo(45.74891);
        assertThat(decoded.get(1)[1]).isEqualTo(21.2318);
    }

    // Reference decoder, same algorithm as the frontend's.
    private static List<double[]> decode(String text) {
        List<double[]> out = new java.util.ArrayList<>();
        int i = 0;
        long lat = 0;
        long lon = 0;
        while (i < text.length()) {
            long[] values = new long[2];
            for (int k = 0; k < 2; k++) {
                long result = 0;
                int shift = 0;
                int b;
                do {
                    b = text.charAt(i++) - 63;
                    result |= (long) (b & 0x1f) << shift;
                    shift += 5;
                } while (b >= 0x20);
                values[k] = (result & 1) != 0 ? ~(result >> 1) : result >> 1;
            }
            lat += values[0];
            lon += values[1];
            out.add(new double[] {lat / 1e5, lon / 1e5});
        }
        return out;
    }
}
