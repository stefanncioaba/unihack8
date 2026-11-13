package com.unihack8.backend.common.geo;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.within;

import com.unihack8.backend.common.exception.ApiException;
import com.unihack8.backend.common.exception.ErrorCode;
import org.junit.jupiter.api.Test;

/** Parsing of the near= and bbox= query formats and the distance helper. */
class GeoParsingTest {

    // "lat,lon" with spaces is accepted.
    @Test
    void parsesNear() {
        GeoPoint p = GeoPoint.parse(" 45.7537 , 21.2257 ", "near");
        assertThat(p.lat()).isEqualTo(45.7537);
        assertThat(p.lon()).isEqualTo(21.2257);
    }

    // Bad near values answer VALIDATION_FAILED.
    @Test
    void rejectsBadNear() {
        for (String bad : new String[] {"", "45.7", "a,b", "95,21", "45,200", "1,2,3"}) {
            assertThatThrownBy(() -> GeoPoint.parse(bad, "near"))
                    .isInstanceOf(ApiException.class)
                    .extracting(e -> ((ApiException) e).code())
                    .isEqualTo(ErrorCode.VALIDATION_FAILED);
        }
    }

    // Piața Victoriei to the Dâmbovița stop is about 2.7 km.
    @Test
    void distanceIsHaversine() {
        GeoPoint victoriei = new GeoPoint(45.7537, 21.2257);
        assertThat(victoriei.distanceMeters(45.74015, 21.19611)).isCloseTo(2_700, within(300.0));
        assertThat(victoriei.distanceMeters(45.7537, 21.2257)).isZero();
    }

    // bbox is minLon,minLat,maxLon,maxLat; blank means no filter.
    @Test
    void parsesBbox() {
        BoundingBox box = BoundingBox.parseOptional("21.18,45.73,21.26,45.77");
        assertThat(box.contains(45.75, 21.2)).isTrue();
        assertThat(box.contains(45.80, 21.2)).isFalse();
        assertThat(BoundingBox.parseOptional(null)).isNull();
        assertThat(BoundingBox.parseOptional(" ")).isNull();
    }

    // Wrong number of values, text, or min > max answer VALIDATION_FAILED.
    @Test
    void rejectsBadBbox() {
        for (String bad : new String[] {"1,2,3", "a,b,c,d", "21.26,45.73,21.18,45.77"}) {
            assertThatThrownBy(() -> BoundingBox.parseOptional(bad))
                    .isInstanceOf(ApiException.class)
                    .extracting(e -> ((ApiException) e).code())
                    .isEqualTo(ErrorCode.VALIDATION_FAILED);
        }
    }
}
