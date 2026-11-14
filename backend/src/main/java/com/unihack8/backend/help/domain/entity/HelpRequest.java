package com.unihack8.backend.help.domain.entity;

import java.time.Instant;
import java.util.UUID;

/** One row of help_requests. {@code lat}/{@code lon} are both null or both set. */
public record HelpRequest(UUID id, UUID requesterId, String title, String description, String category,
                          String address, Double lat, Double lon, String status, Instant createdAt,
                          Instant expiresAt, Instant closedAt, UUID helperId) {
}
