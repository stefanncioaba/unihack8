package com.unihack8.backend.reviews.mapper.impl;

import com.unihack8.backend.events.domain.dto.UserSummary;
import com.unihack8.backend.reviews.domain.dto.ReviewResponse;
import com.unihack8.backend.reviews.domain.entity.EventReview;
import com.unihack8.backend.reviews.mapper.ReviewMapper;
import org.springframework.stereotype.Component;

/** Hand-written review mapping. */
@Component
public class ReviewMapperImpl implements ReviewMapper {
    // Copies the review fields next to the reviewer summary.
    @Override
    public ReviewResponse toResponse(EventReview review, UserSummary reviewer) {
        return new ReviewResponse(reviewer, review.rating(), review.comment(), review.createdAt(), review.updatedAt());
    }
}
