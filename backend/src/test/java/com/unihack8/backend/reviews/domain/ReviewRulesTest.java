package com.unihack8.backend.reviews.domain;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.time.Instant;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

/** The organiser rating formula and the review window. */
class ReviewRulesTest {

    // Above 3 stars gains, 3 or below loses, scaled to the average and capped at +/-5.
    @ParameterizedTest
    @CsvSource({"5.0,5", "4.5,4", "4.0,3", "3.4,1", "3.01,1", "3.0,-1", "2.9,-1", "2.0,-3", "1.5,-4", "1.0,-5"})
    void ratingPointsFollowTheAverage(double average, int points) {
        assertEquals(points, ReviewRules.ratingPoints(average));
    }

    // Reviews close 24 h after the end, or 27 h after the start when there is no end time.
    @Test
    void reviewsCloseADayAfterTheEnd() {
        Instant start = Instant.parse("2026-11-14T18:00:00Z");
        assertEquals(Instant.parse("2026-11-15T22:00:00Z"),
                ReviewRules.closesAt(start, Instant.parse("2026-11-14T22:00:00Z")));
        assertEquals(Instant.parse("2026-11-15T21:00:00Z"), ReviewRules.closesAt(start, null));
    }
}
