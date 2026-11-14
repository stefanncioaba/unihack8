package com.unihack8.backend.reviews.domain.dto;

/**
 * Average rating and number of reviews of one event.
 *
 * @param average exact average, or null when there are no reviews
 * @param count   number of reviews
 */
public record RatingStats(Double average, int count) {
    public static final RatingStats NONE = new RatingStats(null, 0);

    // Average rounded to one decimal for the API, or null without reviews.
    public Double rounded() {
        return average == null ? null : Math.round(average * 10) / 10.0;
    }
}
