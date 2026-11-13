package com.unihack8.backend.events.domain.dto;

import java.time.Instant;

/** A participant visible on an event page. */
public record ParticipantResponse(UserSummary user, String status, Instant joinedAt) {
}
