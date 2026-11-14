package com.unihack8.backend.neighbourhoods.domain.dto;

import java.time.Instant;
import java.util.UUID;

/**
 * An event shown on an area card.
 *
 * @param happeningNow true when it has started and not ended yet; false = later tonight
 * @param spotsLeft    free spots, or null when the event has no limit
 */
public record PulseEventDto(UUID id, String title, String category, String venueName, Instant startsAt,
                            Instant endsAt, Integer capacity, Integer spotsLeft, String imageUrl,
                            boolean happeningNow) {
}
