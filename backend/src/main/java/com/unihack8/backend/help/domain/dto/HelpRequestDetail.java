package com.unihack8.backend.help.domain.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.unihack8.backend.events.domain.dto.UserSummary;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** GET /help-requests/{id}: the summary fields plus description, helper, offers and what the caller may do. */
public record HelpRequestDetail(UUID id, String title, String description, String category, String address,
                                Double lat, Double lon, UserSummary requester, String status, Instant createdAt,
                                Instant expiresAt, Instant closedAt, int offerCount, String myOffer,
                                UserSummary helper, List<HelpOfferResponse> offers,
                                @JsonProperty("isRequester") boolean isRequester, boolean canOffer) {
}
