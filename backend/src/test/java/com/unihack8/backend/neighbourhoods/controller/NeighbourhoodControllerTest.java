package com.unihack8.backend.neighbourhoods.controller;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.unihack8.backend.neighbourhoods.domain.dto.NeighbourhoodPulseDto;
import com.unihack8.backend.neighbourhoods.domain.dto.NeighbourhoodPulseResponse;
import com.unihack8.backend.neighbourhoods.domain.dto.PulseEventDto;
import com.unihack8.backend.neighbourhoods.domain.dto.PulseEventsDto;
import com.unihack8.backend.neighbourhoods.domain.dto.PulsePeopleDto;
import com.unihack8.backend.neighbourhoods.domain.dto.PulsePlacesDto;
import com.unihack8.backend.neighbourhoods.domain.dto.PulseTransitDto;
import com.unihack8.backend.neighbourhoods.service.NeighbourhoodPulseService;
import com.unihack8.backend.transit.domain.dto.AlertDto;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

/** HTTP shape of GET /neighbourhoods/pulse (docs/API.md -> Neighbourhoods); public, no token. */
@SpringBootTest
@AutoConfigureMockMvc
class NeighbourhoodControllerTest {

    private static final Instant T = Instant.parse("2026-11-14T18:00:00Z");

    @Autowired
    private MockMvc mvc;

    @MockitoBean
    private NeighbourhoodPulseService pulse;

    // Every section is in the JSON, times are ISO strings, no token needed.
    @Test
    void pulseWithoutToken() throws Exception {
        UUID eventId = UUID.randomUUID();
        when(pulse.pulse()).thenReturn(new NeighbourhoodPulseResponse(T, List.of(new NeighbourhoodPulseDto(
                "cetate", "Cetate", 45.7568, 21.229, 750, "BUSY", 18,
                new PulseEventsDto(1, 2, 7, List.of(new PulseEventDto(eventId, "Jazz", "CONCERT", "Club",
                        T, null, 20, 7, null, true))),
                new PulseTransitDto(true, List.of("1", "E2"), 4, 3, List.of(new AlertDto("a", "Info", "Linia 1"))),
                new PulsePlacesDto(120, 64, List.of("restaurant", "cafe")),
                new PulsePeopleDto(9, 7)))));

        mvc.perform(get("/neighbourhoods/pulse"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.generatedAt").value("2026-11-14T18:00:00Z"))
                .andExpect(jsonPath("$.areas[0].id").value("cetate"))
                .andExpect(jsonPath("$.areas[0].level").value("BUSY"))
                .andExpect(jsonPath("$.areas[0].events.highlights[0].id").value(eventId.toString()))
                .andExpect(jsonPath("$.areas[0].events.highlights[0].happeningNow").value(true))
                .andExpect(jsonPath("$.areas[0].events.freeSpots").value(7))
                .andExpect(jsonPath("$.areas[0].transit.lines[1]").value("E2"))
                .andExpect(jsonPath("$.areas[0].transit.alerts[0].description").value("Linia 1"))
                .andExpect(jsonPath("$.areas[0].places.openNow").value(64))
                .andExpect(jsonPath("$.areas[0].people.reliableGoing").value(7));
    }
}
