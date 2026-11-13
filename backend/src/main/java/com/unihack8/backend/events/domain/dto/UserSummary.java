package com.unihack8.backend.events.domain.dto;

import java.util.UUID;

/** Public participant or organizer identity. */
public record UserSummary(UUID id, String username, int reliabilityScore) {
}
