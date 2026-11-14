package com.unihack8.backend.ai.domain.dto;

/**
 * A route the assistant planned for its answer (PLAN 18.1); the app shows it as a route card.
 *
 * @param mode           WALK or TRANSIT: what the route really uses
 * @param startsFromUser true only when the request carried the user's real location and the route starts there
 *                       (the app shows the "Go" button only then, PLAN 18.3)
 */
public record ChatRouteDto(RoutePointDto from, RoutePointDto to, String mode, long durationMinutes,
                           long distanceMeters, boolean startsFromUser) {
}
