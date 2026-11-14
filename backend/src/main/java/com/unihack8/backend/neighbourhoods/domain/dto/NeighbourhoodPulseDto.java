package com.unihack8.backend.neighbourhoods.domain.dto;

/**
 * One live area card.
 *
 * @param level QUIET, STEADY or BUSY, from the activity score
 * @param score activity score the level comes from (higher = busier); the list is sorted by it
 */
public record NeighbourhoodPulseDto(String id, String name, double lat, double lon, int radiusMeters,
                                    String level, int score, PulseEventsDto events, PulseTransitDto transit,
                                    PulsePlacesDto places, PulsePeopleDto people) {
}
