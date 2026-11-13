package com.unihack8.backend.routing.util;

import static org.assertj.core.api.Assertions.assertThat;

import com.unihack8.backend.common.geo.GeoPoint;
import java.util.List;
import org.junit.jupiter.api.Test;

/** Google encoded polyline format. */
class PolylineEncoderTest {

    private static final List<GeoPoint> GOOGLE_EXAMPLE = List.of(
            new GeoPoint(38.5, -120.2), new GeoPoint(40.7, -120.95), new GeoPoint(43.252, -126.453));

    // Matches the example from Google's format documentation.
    @Test
    void encodesGoogleExample() {
        assertThat(PolylineEncoder.encode(GOOGLE_EXAMPLE)).isEqualTo("_p~iF~ps|U_ulLnnqC_mqNvxq`@");
    }

    // Decoding the example gives the original points back.
    @Test
    void decodesGoogleExample() {
        assertThat(PolylineEncoder.decode("_p~iF~ps|U_ulLnnqC_mqNvxq`@")).isEqualTo(GOOGLE_EXAMPLE);
    }

    // Encode then decode keeps Timișoara coordinates (5 decimals).
    @Test
    void roundTrip() {
        List<GeoPoint> points = List.of(new GeoPoint(45.7537, 21.2257), new GeoPoint(45.7505, 21.2075));
        assertThat(PolylineEncoder.decode(PolylineEncoder.encode(points))).isEqualTo(points);
    }

    // No points, empty string.
    @Test
    void emptyList() {
        assertThat(PolylineEncoder.encode(List.of())).isEmpty();
        assertThat(PolylineEncoder.decode("")).isEmpty();
    }
}
