package com.unihack8.backend.neighbourhoods.mapper;

import com.unihack8.backend.events.domain.dto.EventSummary;
import com.unihack8.backend.neighbourhoods.domain.dto.NeighbourhoodPulseDto;
import com.unihack8.backend.neighbourhoods.domain.dto.PulseEventDto;
import com.unihack8.backend.neighbourhoods.domain.dto.PulseEventsDto;
import com.unihack8.backend.neighbourhoods.domain.dto.PulsePeopleDto;
import com.unihack8.backend.neighbourhoods.domain.dto.PulsePlacesDto;
import com.unihack8.backend.neighbourhoods.domain.dto.PulseTransitDto;
import com.unihack8.backend.neighbourhoods.domain.model.Neighbourhood;

/** Builds the Neighbourhood Pulse answer pieces. */
public interface NeighbourhoodPulseMapper {
    // An event card; happeningNow tells whether it is running now or later tonight.
    PulseEventDto toEvent(EventSummary event, boolean happeningNow);

    // The full area card.
    NeighbourhoodPulseDto toPulse(Neighbourhood area, String level, int score, PulseEventsDto events,
                                  PulseTransitDto transit, PulsePlacesDto places, PulsePeopleDto people);
}
