package com.unihack8.backend.ai.domain.dto;

/**
 * One end of a route in a chat answer (PLAN 18.1).
 *
 * @param name "Your location" for the user, the place/event name the tools returned, or null when unknown
 */
public record RoutePointDto(double lat, double lon, String name) {
}
