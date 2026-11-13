package com.unihack8.backend.reliability.domain.dto;

import jakarta.validation.constraints.NotBlank;

/**
 * Body of POST /events/{id}/check-in: the string the organiser's camera read from the QR code.
 *
 * @param token the participant's qrToken
 */
public record CheckInRequest(@NotBlank String token) {
}
