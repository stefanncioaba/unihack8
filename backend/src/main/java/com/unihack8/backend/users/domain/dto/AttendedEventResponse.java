package com.unihack8.backend.users.domain.dto;

import java.time.Instant;
import java.util.UUID;

public record AttendedEventResponse(UUID id, String title, Instant startsAt) {
}
