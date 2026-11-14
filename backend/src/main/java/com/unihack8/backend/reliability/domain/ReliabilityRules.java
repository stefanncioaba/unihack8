package com.unihack8.backend.reliability.domain;

import java.time.Duration;
import java.time.Instant;

/**
 * Reliability point rules agreed in PLAN 1.7 (DOCS.md -> Reliability rules). The late-cancel rule
 * (-2) lives in the events feature, where leaving happens.
 */
public final class ReliabilityRules {

    public static final int ATTENDED_POINTS = 5;
    public static final int NO_SHOW_POINTS = -10;
    public static final String ATTENDED_REASON = "ATTENDED";
    public static final String NO_SHOW_REASON = "NO_SHOW";
    // Volunteer actions (park cleanups, food drives): events with this category give a bonus on check-in.
    public static final String VOLUNTEER_CATEGORY = "VOLUNTEER";
    public static final int VOLUNTEER_BONUS_POINTS = 5;
    public static final String VOLUNTEER_BONUS_REASON = "VOLUNTEER_BONUS";
    // An event without an end time is treated as ending this long after it starts.
    public static final Duration DEFAULT_EVENT_LENGTH = Duration.ofHours(3);

    // Constants only.
    private ReliabilityRules() {
    }

    // Extra points for checking in at this category: +5 for VOLUNTEER, 0 otherwise.
    public static int checkInBonus(String category) {
        return VOLUNTEER_CATEGORY.equals(category) ? VOLUNTEER_BONUS_POINTS : 0;
    }

    // When the event counts as over: its end time, or start + 3 hours when it has none.
    public static Instant effectiveEnd(Instant startsAt, Instant endsAt) {
        return endsAt != null ? endsAt : startsAt.plus(DEFAULT_EVENT_LENGTH);
    }
}
