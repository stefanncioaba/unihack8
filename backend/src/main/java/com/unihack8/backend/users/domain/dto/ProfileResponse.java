package com.unihack8.backend.users.domain.dto;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record ProfileResponse(UUID id, String username, int reliabilityScore, Instant createdAt,
                              List<AttendedEventResponse> attendedEvents) {
}
