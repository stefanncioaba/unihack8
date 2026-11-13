package com.unihack8.backend.reliability.domain.dto;

import java.util.UUID;

/**
 * GET /events/{id}/my-ticket (docs/API.md). The app draws {@code qrToken} as a QR code; the QR code
 * contains only that string.
 *
 * @param status JOINED, ATTENDED or NO_SHOW
 */
public record TicketResponse(UUID eventId, UUID qrToken, String status) {
}
