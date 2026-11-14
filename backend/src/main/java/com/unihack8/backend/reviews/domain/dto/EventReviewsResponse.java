package com.unihack8.backend.reviews.domain.dto;

import java.time.Instant;
import java.util.List;

/**
 * Answer of GET /events/{id}/reviews.
 *
 * @param averageRating  one decimal, null without reviews
 * @param reviewsCloseAt end of the event + 24 h; null for imported events
 * @param settled        the organiser's rating points were already applied
 * @param canReview      the caller attended, is not the organiser, and reviews are still open
 * @param myReview       the caller's own review, if any
 */
public record EventReviewsResponse(Double averageRating, int reviewCount, List<ReviewResponse> reviews,
        Instant reviewsCloseAt, boolean settled, boolean canReview, ReviewResponse myReview) {
}
