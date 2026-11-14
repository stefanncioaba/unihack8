package com.unihack8.backend.help.domain.dto;

import com.unihack8.backend.events.domain.dto.UserSummary;
import java.time.Instant;
import java.util.UUID;

/** A help request on the board or in "mine" (docs/API.md -> HelpRequestSummary). */
public record HelpRequestSummary(UUID id, String title, String category, String address, Double lat, Double lon,
                                 UserSummary requester, String status, Instant createdAt, Instant expiresAt,
                                 int offerCount, String myOffer) {
}
