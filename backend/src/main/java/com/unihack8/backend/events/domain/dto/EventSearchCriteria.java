package com.unihack8.backend.events.domain.dto;

import com.unihack8.backend.common.geo.BoundingBox;
import java.time.Instant;
import java.util.List;

/** Validated event-list filters. */
public record EventSearchCriteria(String query, List<String> categories, Instant from, Instant to,
        BoundingBox bbox, String source) {
}
