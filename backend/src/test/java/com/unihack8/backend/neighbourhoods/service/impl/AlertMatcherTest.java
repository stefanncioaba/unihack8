package com.unihack8.backend.neighbourhoods.service.impl;

import static org.assertj.core.api.Assertions.assertThat;

import com.unihack8.backend.transit.domain.dto.AlertDto;
import java.util.List;
import org.junit.jupiter.api.Test;

/** Which STPT alerts concern an area. */
class AlertMatcherTest {

    // Helper: an alert with only a description.
    private static AlertDto alert(String text) {
        return new AlertDto("1", "Info trafic", text);
    }

    // "linia 8" names line 8.
    @Test
    void lineWordFollowedByName() {
        assertThat(AlertMatcher.concerns(alert("Linia 8 circulă deviat"), List.of("8"), List.of())).isTrue();
        assertThat(AlertMatcher.concerns(alert("Linia 8 circulă deviat"), List.of("1"), List.of())).isFalse();
    }

    // Lists of lines and letter lines: "tramvaiele 1 și 2", "liniile E2, 33b".
    @Test
    void listsAndLetterLines() {
        assertThat(AlertMatcher.mentionedLines("tramvaiele 1 si 2 nu circula")).contains("1", "2");
        assertThat(AlertMatcher.concerns(alert("Liniile E2, 33b sunt deviate"), List.of("E2"), List.of())).isTrue();
        assertThat(AlertMatcher.concerns(alert("Liniile E2, 33b sunt deviate"), List.of("33B"), List.of())).isTrue();
    }

    // A bare number (date, house number) is not a line.
    @Test
    void bareNumbersDoNotCount() {
        assertThat(AlertMatcher.concerns(alert("Lucrări pe 14 noiembrie la nr. 8"), List.of("8", "14"), List.of()))
                .isFalse();
    }

    // A stop name in the text ties the alert to the area; very short names are ignored.
    @Test
    void stopNames() {
        assertThat(AlertMatcher.concerns(alert("Stația Piața Traian este închisă"), List.of(), List.of("Piața Traian")))
                .isTrue();
        assertThat(AlertMatcher.concerns(alert("Statia UMT inchisa"), List.of(), List.of("UMT"))).isFalse();
    }

    // Empty alerts never match.
    @Test
    void emptyAlert() {
        assertThat(AlertMatcher.concerns(new AlertDto("1", null, null), List.of("1"), List.of("Piața Traian")))
                .isFalse();
    }
}
