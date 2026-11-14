package com.unihack8.backend.reviews.controller;

import com.unihack8.backend.common.security.CurrentUser;
import com.unihack8.backend.reviews.domain.dto.EventReviewsResponse;
import com.unihack8.backend.reviews.domain.dto.ReviewRequest;
import com.unihack8.backend.reviews.domain.dto.ReviewResponse;
import com.unihack8.backend.reviews.service.ReviewService;
import java.util.UUID;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/** Event review endpoints (docs/API.md -> reviews). Reading is public, writing needs a signed-in attendee. */
@RestController
public class ReviewController {
    private final ReviewService reviews;
    private final CurrentUser currentUser;

    // Needs the review service and the current-user helper.
    public ReviewController(ReviewService reviews, CurrentUser currentUser) {
        this.reviews = reviews;
        this.currentUser = currentUser;
    }

    // GET /events/{id}/reviews — average, every review with its author, and the caller's review state.
    @GetMapping("/events/{id}/reviews")
    public EventReviewsResponse list(@PathVariable UUID id) {
        return reviews.reviews(id, currentUser.optionalId());
    }

    // PUT /events/{id}/reviews/me — creates or replaces the caller's review.
    @PutMapping("/events/{id}/reviews/me")
    public ReviewResponse save(@PathVariable UUID id, @RequestBody ReviewRequest request) {
        return reviews.save(id, currentUser.id(), request);
    }
}
