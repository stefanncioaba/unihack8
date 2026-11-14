package com.unihack8.backend.users.domain.dto;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** Public profile: score, attended events and past organised events (with their ratings), newest first. */
public record ProfileResponse(UUID id, String username, int reliabilityScore, Instant createdAt,
                              List<AttendedEventResponse> attendedEvents,
                              List<AttendedEventResponse> organizedEvents) {
}
