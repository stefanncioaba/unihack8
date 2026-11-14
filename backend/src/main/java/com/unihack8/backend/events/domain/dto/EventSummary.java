package com.unihack8.backend.events.domain.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/** EventSummary from the mobile API contract; averageRating is null and reviewCount 0 without reviews. */
public record EventSummary(UUID id, String source, String title, String category, String venueName,
        Double lat, Double lon, Instant startsAt, Instant endsAt, String imageUrl,
        BigDecimal priceMin, BigDecimal priceMax, Integer capacity, Integer spotsLeft,
        Double averageRating, int reviewCount) {
}
