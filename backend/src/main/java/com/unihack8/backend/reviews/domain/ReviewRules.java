package com.unihack8.backend.reviews.domain;

import com.unihack8.backend.reliability.domain.ReliabilityRules;
import java.time.Duration;
import java.time.Instant;

/** Review window and the organiser rating rule (DOCS.md -> Event reviews). */
public final class ReviewRules {

    public static final int MIN_RATING = 1;
    public static final int MAX_RATING = 5;
    public static final int MAX_COMMENT_LENGTH = 300;
    // Reviews stay open this long after the event ends; then the rating is settled.
    public static final Duration REVIEW_WINDOW = Duration.ofHours(24);
    // Ratings above this gain points, ratings at or below it lose points.
    public static final double NEUTRAL_RATING = 3.0;
    // Points per star away from neutral, so 5 stars = +5 and 1 star = -5.
    public static final double POINTS_PER_STAR = 2.5;
    public static final String RATING_REASON = "EVENT_RATING";

    // Constants only.
    private ReviewRules() {
    }

    // When reviews close: the event's effective end + 24 h.
    public static Instant closesAt(Instant startsAt, Instant endsAt) {
        return ReliabilityRules.effectiveEnd(startsAt, endsAt).plus(REVIEW_WINDOW);
    }

    // Organiser points for an average: round((avg - 3) * 2.5) half away from zero, at least +1 / -1.
    public static int ratingPoints(double average) {
        double raw = (average - NEUTRAL_RATING) * POINTS_PER_STAR;
        int points = (int) (Math.signum(raw) * Math.round(Math.abs(raw)));
        return average > NEUTRAL_RATING ? Math.max(1, points) : Math.min(-1, points);
    }
}
