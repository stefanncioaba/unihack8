package com.unihack8.backend.neighbourhoods.domain.dto;

import java.util.List;

/**
 * Events in an area right now and later tonight.
 *
 * @param nowCount     events that have started and not ended
 * @param tonightCount events that start later, before 05:00 local time
 * @param freeSpots    free spots across the limited events (unlimited events are not counted)
 * @param highlights   up to 3 events, the ones happening now first
 */
public record PulseEventsDto(int nowCount, int tonightCount, int freeSpots, List<PulseEventDto> highlights) {
}
