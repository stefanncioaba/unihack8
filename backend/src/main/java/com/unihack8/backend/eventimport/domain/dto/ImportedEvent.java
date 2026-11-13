package com.unihack8.backend.eventimport.domain.dto;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * An external event ready to be stored as an events row with source = EXTERNAL (PLAN 7.2).
 *
 * @param externalId  "livetickets:&lt;LiveTickets event id&gt;" (unique in events.external_id)
 * @param description plain text (HTML removed), or null
 * @param category    one of the event categories from docs/API.md (PARTY, CONCERT, ..., OTHER)
 * @param endsAt      null when unknown or not after startsAt
 * @param externalUrl the LiveTickets ticket page
 */
public record ImportedEvent(
        String externalId,
        String title,
        String description,
        String category,
        String venueName,
        Instant startsAt,
        Instant endsAt,
        String imageUrl,
        BigDecimal priceMin,
        BigDecimal priceMax,
        String externalUrl) {
}
