package com.unihack8.backend.help.domain.dto;

import com.unihack8.backend.events.domain.dto.UserSummary;
import java.time.Instant;

/** One offer on a help request's detail page, so the requester can choose whom to trust. */
public record HelpOfferResponse(UserSummary user, String status, Instant offeredAt) {
}
