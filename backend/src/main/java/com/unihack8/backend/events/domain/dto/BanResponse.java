package com.unihack8.backend.events.domain.dto;

import java.util.UUID;

/** Result of an organizer ban. */
public record BanResponse(UUID userId, String status) {
}
