package com.unihack8.backend.reviews.domain.dto;

import com.unihack8.backend.events.domain.dto.UserSummary;
import java.time.Instant;

/** One review as shown on the event page, with who wrote it. */
public record ReviewResponse(UserSummary reviewer, int rating, String comment, Instant createdAt, Instant updatedAt) {
}
