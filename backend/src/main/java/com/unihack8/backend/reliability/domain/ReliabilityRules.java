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
    // An event without an end time is treated as ending this long after it starts.
    public static final Duration DEFAULT_EVENT_LENGTH = Duration.ofHours(3);

    // Constants only.
    private ReliabilityRules() {
    }

    // When the event counts as over: its end time, or start + 3 hours when it has none.
    public static Instant effectiveEnd(Instant startsAt, Instant endsAt) {
        return endsAt != null ? endsAt : startsAt.plus(DEFAULT_EVENT_LENGTH);
    }
}
