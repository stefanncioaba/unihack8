package com.unihack8.backend.reviews.service;

import com.unihack8.backend.reviews.domain.dto.EventReviewsResponse;
import com.unihack8.backend.reviews.domain.dto.ReviewRequest;
import com.unihack8.backend.reviews.domain.dto.ReviewResponse;
import java.util.Optional;
import java.util.UUID;

/** Reading and writing event reviews. */
public interface ReviewService {
    // All reviews of an event with the average and the caller's own review state.
    EventReviewsResponse reviews(UUID eventId, Optional<UUID> caller);

    // Creates or replaces the caller's review; only checked-in attendees, while reviews are open.
    ReviewResponse save(UUID eventId, UUID caller, ReviewRequest request);
}
