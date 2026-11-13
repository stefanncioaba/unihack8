package com.unihack8.backend.places.domain;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDateTime;
import org.junit.jupiter.api.Test;

/** OpenStreetMap opening_hours reading (used by the AI to skip closed places). 2026-11-13 is a Friday. */
class OpeningHoursTest {

    private static final LocalDateTime FRIDAY_2345 = LocalDateTime.of(2026, 11, 13, 23, 45);
    private static final LocalDateTime FRIDAY_1000 = LocalDateTime.of(2026, 11, 13, 10, 0);
    private static final LocalDateTime SATURDAY_0900 = LocalDateTime.of(2026, 11, 14, 9, 0);
    private static final LocalDateTime SATURDAY_0130 = LocalDateTime.of(2026, 11, 14, 1, 30);
    private static final LocalDateTime MONDAY_0030 = LocalDateTime.of(2026, 11, 16, 0, 30);

    // Weekday and weekend rules with different hours.
    @Test
    void weekdayAndWeekendRules() {
        String hours = "Mo-Fr 07:00-19:00; Sa,Su 10:00-19:00";
        assertThat(OpeningHours.at(hours, FRIDAY_1000)).isEqualTo(new OpeningHours.Status(true, "19:00"));
        assertThat(OpeningHours.at(hours, FRIDAY_2345)).isEqualTo(new OpeningHours.Status(false, null));
        assertThat(OpeningHours.at(hours, SATURDAY_0900)).isEqualTo(new OpeningHours.Status(false, "10:00"));
    }

    // "24:00" and closing after midnight count as open late; Saturday 01:30 is still Friday's night.
    @Test
    void lateClosingAndAfterMidnight() {
        assertThat(OpeningHours.at("Mo-Su 09:00-24:00", FRIDAY_2345)).isEqualTo(new OpeningHours.Status(true, "24:00"));
        assertThat(OpeningHours.at("Fr 18:00-02:00", SATURDAY_0130)).isEqualTo(new OpeningHours.Status(true, "02:00"));
        assertThat(OpeningHours.at("Fr 18:00-02:00", FRIDAY_1000).open()).isFalse();
        // Sunday night into Monday wraps around the week.
        assertThat(OpeningHours.at("Su 20:00-02:00", MONDAY_0030).open()).isTrue();
    }

    // Several ranges in one day, "off", 24/7 and a rule with no days (every day).
    @Test
    void otherForms() {
        assertThat(OpeningHours.at("Mo-Fr 08:00-12:00,14:00-18:00", FRIDAY_1000).open()).isTrue();
        assertThat(OpeningHours.at("Mo-Fr 08:00-09:00,14:00-18:00", FRIDAY_1000))
                .isEqualTo(new OpeningHours.Status(false, "14:00"));
        assertThat(OpeningHours.at("Mo-Su 10:00-22:00; Fr off", FRIDAY_1000).open()).isFalse();
        assertThat(OpeningHours.at("24/7", FRIDAY_2345).open()).isTrue();
        assertThat(OpeningHours.at("08:00-20:00", SATURDAY_0900).open()).isTrue();
        assertThat(OpeningHours.at("Tu-Fr 07:00-19:00; Sa 08:00-17:00", SATURDAY_0900).open()).isTrue();
    }

    // Anything not understood is "unknown", never a wrong yes/no.
    @Test
    void unknownForms() {
        assertThat(OpeningHours.at(null, FRIDAY_1000).open()).isNull();
        assertThat(OpeningHours.at("", FRIDAY_1000).open()).isNull();
        assertThat(OpeningHours.at("Mo-Fr 08:00-20:00; PH off", FRIDAY_1000).open()).isNull();
        assertThat(OpeningHours.at("sunrise-sunset", FRIDAY_1000).open()).isNull();
        assertThat(OpeningHours.at("Jan-Mar Mo-Fr 08:00-12:00", FRIDAY_1000).open()).isNull();
    }
}
