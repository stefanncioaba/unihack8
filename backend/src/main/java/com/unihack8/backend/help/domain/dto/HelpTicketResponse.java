package com.unihack8.backend.help.domain.dto;

import java.util.UUID;

/** A helper's QR ticket (the QR code contains only {@code qrToken}) and their offer status. */
public record HelpTicketResponse(UUID requestId, UUID qrToken, String status) {
}
