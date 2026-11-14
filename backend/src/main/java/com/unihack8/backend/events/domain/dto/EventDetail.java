package com.unihack8.backend.events.domain.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/** Detailed event response, including caller-specific participation. */
public record EventDetail(UUID id, String source, String title, String description, String category,
        String venueName, String address, Double lat, Double lon, Instant startsAt, Instant endsAt,
        String imageUrl, BigDecimal priceMin, BigDecimal priceMax, String externalUrl,
        Integer capacity, Integer spotsLeft, int participantCount, UserSummary organizer, String myStatus,
        Double averageRating, int reviewCount) {
}
