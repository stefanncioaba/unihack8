package com.unihack8.backend.help.domain.entity;

import java.time.Instant;
import java.util.UUID;

/** One row of help_offers: a user who offered to help, with the QR token the requester scans. */
public record HelpOffer(UUID requestId, UUID helperId, String status, UUID qrToken, Instant offeredAt,
                        Instant checkedInAt) {
}
