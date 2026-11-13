package com.unihack8.backend.reliability.domain.dto;

import com.unihack8.backend.events.domain.dto.UserSummary;

/**
 * Answer to a successful scan (docs/API.md -> POST /events/{id}/check-in).
 *
 * @param user         the participant, with their new reliability score
 * @param status       always ATTENDED
 * @param pointsChange points added by this check-in (+5)
 */
public record CheckInResponse(UserSummary user, String status, int pointsChange) {
}
