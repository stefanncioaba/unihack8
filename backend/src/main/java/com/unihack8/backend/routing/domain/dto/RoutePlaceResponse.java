package com.unihack8.backend.routing.domain.dto;

/** Start or end point of a route leg (a stop name, or "Start" / "Destination"). */
public record RoutePlaceResponse(String name, double lat, double lon) {
}
