package com.unihack8.backend.reliability.domain.entity;

import java.time.Instant;
import java.util.UUID;

/**
 * One reliability_log row joined with its event's title (title null when the event was deleted).
 */
public record ReliabilityLogEntry(int pointsChange, String reason, UUID eventId, String eventTitle,
                                  Instant createdAt) {
}
