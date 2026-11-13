package com.unihack8.backend.events.domain.dto;

import java.time.Instant;

/** Required fields for a user-created event; optional fields may be null. */
public record CreateEventRequest(String title, String description, String category, String venueName,
        String address, Double lat, Double lon, Instant startsAt, Instant endsAt, Integer capacity) {
}
