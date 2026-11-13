package com.unihack8.backend.routing.domain.model;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.unihack8.backend.common.exception.ApiException;
import com.unihack8.backend.common.exception.ErrorCode;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullSource;
import org.junit.jupiter.params.provider.ValueSource;

/** Parsing "lat,lon" parameters and straight-line distances. */
class GeoPointTest {

    // A well-formed value is parsed, spaces allowed.
    @Test
    void parsesLatLon() {
        assertThat(GeoPoint.parse("from", "45.7537, 21.2257")).isEqualTo(new GeoPoint(45.7537, 21.2257));
    }

    // Malformed or out-of-range values are 400 VALIDATION_FAILED naming the parameter.
    @ParameterizedTest
    @NullSource
    @ValueSource(strings = {"", "45.75", "45.75,21.22,3", "abc,21.22", "91,21", "45,181", "NaN,21", "45,Infinity"})
    void rejectsBadValues(String value) {
        assertThatThrownBy(() -> GeoPoint.parse("to", value))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("'to'")
                .extracting(e -> ((ApiException) e).code())
                .isEqualTo(ErrorCode.VALIDATION_FAILED);
    }

    // Piața Victoriei -> Gara de Nord is about 1.6 km in a straight line.
    @Test
    void distanceBetweenTwoTimisoaraPoints() {
        GeoPoint victoriei = new GeoPoint(45.7537, 21.2257);
        GeoPoint garaDeNord = new GeoPoint(45.7505, 21.2075);
        assertThat(victoriei.distanceMetersTo(garaDeNord)).isBetween(1400.0, 1550.0);
        assertThat(victoriei.distanceMetersTo(victoriei)).isZero();
    }
}
