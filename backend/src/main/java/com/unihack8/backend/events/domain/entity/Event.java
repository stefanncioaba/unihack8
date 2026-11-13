package com.unihack8.backend.events.domain.entity;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

/** One database event, including imported events that cannot be joined. */
public record Event(UUID id, String source, String externalId, String title, String description,
        String category, String venueName, String address, Double lat, Double lon,
        Instant startsAt, Instant endsAt, Integer capacity, UUID organizerId,
        String imageUrl, BigDecimal priceMin, BigDecimal priceMax, String externalUrl, Instant createdAt) {
}
