package com.unihack8.backend.neighbourhoods.domain.dto;

import java.time.Instant;
import java.util.List;

/** GET /neighbourhoods/pulse answer: every area, busiest first. */
public record NeighbourhoodPulseResponse(Instant generatedAt, List<NeighbourhoodPulseDto> areas) {
}
