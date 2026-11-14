package com.unihack8.backend.help.domain;

import java.time.Duration;
import java.time.Instant;
import java.util.Set;

/**
 * Neighbour Help Board rules (PLAN 25, DOCS.md -> Neighbour Help Board). The +5 for the scanned helper
 * lives in ReliabilityRules with the other point rules.
 */
public final class HelpRules {

    // An open request leaves the board this long after it was posted.
    public static final Duration LIFETIME = Duration.ofHours(24);
    public static final int TITLE_MIN = 3;
    public static final int TITLE_MAX = 80;
    public static final int DESCRIPTION_MAX = 500;
    public static final int ADDRESS_MAX = 120;
    public static final int BOARD_LIMIT = 50;
    public static final int MINE_LIMIT = 20;
    public static final Set<String> CATEGORIES = Set.of("BORROW", "CARRY", "PETS", "ERRANDS", "REPAIRS", "OTHER");

    // Stored request statuses; EXPIRED is never stored, it is computed from expires_at.
    public static final String OPEN = "OPEN";
    public static final String HELPED = "HELPED";
    public static final String CANCELLED = "CANCELLED";
    public static final String EXPIRED = "EXPIRED";

    // Offer statuses.
    public static final String OFFERED = "OFFERED";
    public static final String WITHDRAWN = "WITHDRAWN";
    public static final String NOT_NEEDED = "NOT_NEEDED";

    // Constants and helpers only.
    private HelpRules() {
    }

    // When a request posted at this moment stops being open.
    public static Instant expiresAt(Instant createdAt) {
        return createdAt.plus(LIFETIME);
    }

    // The status the API shows: a stored OPEN request past its expiry time is EXPIRED.
    public static String effectiveStatus(String stored, Instant expiresAt, Instant now) {
        return OPEN.equals(stored) && !now.isBefore(expiresAt) ? EXPIRED : stored;
    }

    // True while helpers can still offer and the requester can still scan.
    public static boolean isOpen(String stored, Instant expiresAt, Instant now) {
        return OPEN.equals(effectiveStatus(stored, expiresAt, now));
    }
}
