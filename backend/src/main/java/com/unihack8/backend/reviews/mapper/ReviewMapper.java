package com.unihack8.backend.reviews.mapper;

import com.unihack8.backend.events.domain.dto.UserSummary;
import com.unihack8.backend.reviews.domain.dto.ReviewResponse;
import com.unihack8.backend.reviews.domain.entity.EventReview;

/** Maps stored reviews to the public API shape. */
public interface ReviewMapper {
    // Combines a review with its author's public identity.
    ReviewResponse toResponse(EventReview review, UserSummary reviewer);
}
