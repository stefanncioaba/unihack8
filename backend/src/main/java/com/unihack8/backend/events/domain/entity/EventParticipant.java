package com.unihack8.backend.events.domain.entity;

import java.time.Instant;
import java.util.UUID;

/** Participation state stored under the event/user composite key. */
public record EventParticipant(UUID eventId, UUID userId, String status, UUID qrToken,
        Instant joinedAt, Instant checkedInAt) {
}
