package com.unihack8.backend.routing.domain.dto;

import java.time.Instant;

/**
 * One part of a route (docs/API.md, Routing).
 *
 * @param mode     WALK, TRAM, TROLLEYBUS or BUS
 * @param route    line name (e.g. "1"); null for walking
 * @param headsign direction shown on the vehicle; null for walking
 * @param polyline Google encoded polyline of the leg's path
 */
public record RouteLegResponse(
        String mode,
        String route,
        String headsign,
        RoutePlaceResponse from,
        RoutePlaceResponse to,
        Instant startsAt,
        Instant endsAt,
        long durationMinutes,
        String polyline) {
}
