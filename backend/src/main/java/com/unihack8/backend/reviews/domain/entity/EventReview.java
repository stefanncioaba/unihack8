package com.unihack8.backend.reviews.domain.entity;

import java.time.Instant;
import java.util.UUID;

/** One stored review: an attendee's 1-5 star rating of an event, with an optional comment. */
public record EventReview(UUID eventId, UUID reviewerId, int rating, String comment,
        Instant createdAt, Instant updatedAt) {
}
