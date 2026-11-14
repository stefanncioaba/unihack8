package com.unihack8.backend.neighbourhoods.mapper.impl;

import com.unihack8.backend.events.domain.dto.EventSummary;
import com.unihack8.backend.neighbourhoods.domain.dto.NeighbourhoodPulseDto;
import com.unihack8.backend.neighbourhoods.domain.dto.PulseEventDto;
import com.unihack8.backend.neighbourhoods.domain.dto.PulseEventsDto;
import com.unihack8.backend.neighbourhoods.domain.dto.PulsePeopleDto;
import com.unihack8.backend.neighbourhoods.domain.dto.PulsePlacesDto;
import com.unihack8.backend.neighbourhoods.domain.dto.PulseTransitDto;
import com.unihack8.backend.neighbourhoods.domain.model.Neighbourhood;
import com.unihack8.backend.neighbourhoods.mapper.NeighbourhoodPulseMapper;
import org.springframework.stereotype.Component;

/** Plain field copying for the Neighbourhood Pulse answer. */
@Component
public class NeighbourhoodPulseMapperImpl implements NeighbourhoodPulseMapper {

    // Copies the fields an area card needs from the event list item.
    @Override
    public PulseEventDto toEvent(EventSummary event, boolean happeningNow) {
        return new PulseEventDto(event.id(), event.title(), event.category(), event.venueName(), event.startsAt(),
                event.endsAt(), event.capacity(), event.spotsLeft(), event.imageUrl(), happeningNow);
    }

    // Puts the area's position next to its live sections.
    @Override
    public NeighbourhoodPulseDto toPulse(Neighbourhood area, String level, int score, PulseEventsDto events,
                                         PulseTransitDto transit, PulsePlacesDto places, PulsePeopleDto people) {
        return new NeighbourhoodPulseDto(area.id(), area.name(), area.centre().lat(), area.centre().lon(),
                area.radiusMeters(), level, score, events, transit, places, people);
    }
}
