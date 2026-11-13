package com.unihack8.backend.events.domain.dto;

import java.util.UUID;

/** The participant's stable ticket token. */
public record JoinResponse(UUID eventId, String status, UUID qrToken) {
}
