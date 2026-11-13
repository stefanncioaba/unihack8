package com.unihack8.backend.routing.domain.dto;

import java.time.Instant;
import java.util.List;

/**
 * Answer of GET /routes/plan (docs/API.md, Routing).
 *
 * @param mode     TRANSIT when the route uses public transport, otherwise WALK
 * @param fallback true when OpenTripPlanner could not answer and this is a straight-line walking estimate
 */
public record RoutePlanResponse(
        String mode,
        long durationMinutes,
        long distanceMeters,
        Instant startsAt,
        Instant endsAt,
        boolean fallback,
        List<RouteLegResponse> legs) {
}
