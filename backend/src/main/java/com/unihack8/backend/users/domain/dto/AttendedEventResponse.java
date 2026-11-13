package com.unihack8.backend.users.domain.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/**
 * One attended event on a profile, in the EventSummary shape of docs/API.md.
 * The events feature (PLAN 5) may later replace this with its shared EventSummary.
 *
 * @param spotsLeft null when the event has no capacity limit
 */
public record AttendedEventResponse(
        UUID id,
        String source,
        String title,
        String category,
        String venueName,
        Double lat,
        Double lon,
        Instant startsAt,
        Instant endsAt,
        String imageUrl,
        BigDecimal priceMin,
        BigDecimal priceMax,
        Integer capacity,
        Integer spotsLeft) {
}
