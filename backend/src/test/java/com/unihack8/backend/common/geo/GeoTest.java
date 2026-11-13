package com.unihack8.backend.common.geo;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.within;

import com.unihack8.backend.common.exception.ApiException;
import org.junit.jupiter.api.Test;

/** Coordinate parsing and distance maths used by every map feature. */
class GeoTest {

    // Piața Victoriei to Gara de Nord is about 1.5 km.
    @Test
    void haversineDistanceMatchesKnownValue() {
        GeoPoint victoriei = new GeoPoint(45.7537, 21.2257);
        GeoPoint garaDeNord = new GeoPoint(45.7505, 21.2075);
        assertThat(victoriei.distanceMetersTo(garaDeNord)).isCloseTo(1460, within(30.0));
        assertThat(victoriei.distanceMetersTo(victoriei)).isZero();
    }

    // The box around a point contains everything within the radius.
    @Test
    void boxAroundCoversTheRadius() {
        GeoPoint centre = new GeoPoint(45.75, 21.22);
        BoundingBox box = centre.boxAround(1000);
        assertThat(box.contains(45.75 + 0.0089, 21.22)).isTrue();   // ~990 m north
        assertThat(box.contains(45.75, 21.22 + 0.0127)).isTrue();   // ~990 m east
        assertThat(box.contains(45.77, 21.22)).isFalse();           // ~2.2 km north
    }

    // "lat,lon" parsing, with spaces.
    @Test
    void parsesPoint() {
        assertThat(GeoPoint.parse(" 45.7537 , 21.2257 ", "near")).isEqualTo(new GeoPoint(45.7537, 21.2257));
    }

    // Bad points are 400s.
    @Test
    void rejectsBadPoints() {
        assertThatThrownBy(() -> GeoPoint.parse("45.7", "near")).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> GeoPoint.parse("x,y", "near")).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> GeoPoint.parse("91,0", "near")).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> GeoPoint.parse("NaN,0", "near")).isInstanceOf(ApiException.class);
    }

    // "minLon,minLat,maxLon,maxLat" parsing and order checks.
    @Test
    void parsesBoundingBox() {
        BoundingBox box = BoundingBox.parse("21.18,45.73,21.26,45.77", "bbox");
        assertThat(box).isEqualTo(new BoundingBox(21.18, 45.73, 21.26, 45.77));
        assertThat(box.contains(45.75, 21.22)).isTrue();
        assertThatThrownBy(() -> BoundingBox.parse("21.26,45.73,21.18,45.77", "bbox")).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> BoundingBox.parse("21.18,45.73,21.26", "bbox")).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> BoundingBox.parse("-181,45,21,46", "bbox")).isInstanceOf(ApiException.class);
    }
}
