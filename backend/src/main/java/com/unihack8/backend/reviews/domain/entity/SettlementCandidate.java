package com.unihack8.backend.reviews.domain.entity;

import java.time.Instant;
import java.util.UUID;

/** A started user event whose organiser rating has not been settled yet. */
public record SettlementCandidate(UUID eventId, UUID organizerId, Instant startsAt, Instant endsAt) {
}
