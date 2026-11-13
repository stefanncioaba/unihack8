package com.unihack8.backend.reliability.domain.entity;

import java.time.Instant;
import java.util.UUID;

/**
 * A participant still marked JOINED in a user event that has started (no-show candidate).
 *
 * @param endsAt null when the event has no end time
 */
public record OverdueParticipant(UUID eventId, UUID userId, Instant startsAt, Instant endsAt) {
}
