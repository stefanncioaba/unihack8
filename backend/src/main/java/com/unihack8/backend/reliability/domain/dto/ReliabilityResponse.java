package com.unihack8.backend.reliability.domain.dto;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * GET /users/{id}/reliability (docs/API.md): current score and the most recent changes, newest first.
 */
public record ReliabilityResponse(int reliabilityScore, List<Entry> entries) {

    /**
     * One score change.
     *
     * @param reason     ATTENDED, NO_SHOW or LATE_CANCEL
     * @param eventId    null when the event was deleted
     * @param eventTitle null when the event was deleted
     */
    public record Entry(int pointsChange, String reason, UUID eventId, String eventTitle, Instant createdAt) {
    }
}
