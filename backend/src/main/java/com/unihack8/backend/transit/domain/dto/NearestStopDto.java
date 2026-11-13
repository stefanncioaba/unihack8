package com.unihack8.backend.transit.domain.dto;

/** The stop closest to the caller, used by the home page summary. */
public record NearestStopDto(String id, String name, int distanceMeters) {
}
