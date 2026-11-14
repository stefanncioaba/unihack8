package com.unihack8.backend.reviews.domain.dto;

/**
 * Body of PUT /events/{id}/reviews/me.
 *
 * @param rating  whole stars, 1-5
 * @param comment optional reason, at most 300 characters
 */
public record ReviewRequest(Integer rating, String comment) {
}
