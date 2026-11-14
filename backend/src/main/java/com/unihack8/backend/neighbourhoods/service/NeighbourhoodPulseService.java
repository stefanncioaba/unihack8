package com.unihack8.backend.neighbourhoods.service;

import com.unihack8.backend.neighbourhoods.domain.dto.NeighbourhoodPulseResponse;

/**
 * Neighbourhood Pulse: what each Timișoara area is doing right now. Combines events, places,
 * live transit and reliability from the existing services; no tables of its own.
 */
public interface NeighbourhoodPulseService {
    // Every area's live card, busiest first. A source that is down only empties its own section.
    NeighbourhoodPulseResponse pulse();
}
