package com.unihack8.backend.neighbourhoods.domain.dto;

import com.unihack8.backend.transit.domain.dto.AlertDto;
import java.util.List;

/**
 * Public transport in an area.
 *
 * @param available    false when STPT could not be reached (the other fields are then empty)
 * @param lines        names of the lines stopping in the area, e.g. ["1", "8", "E2"]
 * @param stopCount    stops inside the area
 * @param liveVehicles trams and buses inside the area right now
 * @param alerts       STPT service alerts that name one of the area's lines or stops
 */
public record PulseTransitDto(boolean available, List<String> lines, int stopCount, int liveVehicles,
                              List<AlertDto> alerts) {

    // Answer used when STPT is down.
    public static PulseTransitDto unavailable() {
        return new PulseTransitDto(false, List.of(), 0, 0, List.of());
    }
}
