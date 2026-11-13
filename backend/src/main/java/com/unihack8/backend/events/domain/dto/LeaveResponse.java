package com.unihack8.backend.events.domain.dto;

/** Cancellation result and any reliability adjustment. */
public record LeaveResponse(String status, int pointsChange, int reliabilityScore) {
}
