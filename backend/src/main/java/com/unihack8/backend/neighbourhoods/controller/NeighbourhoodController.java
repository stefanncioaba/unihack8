package com.unihack8.backend.neighbourhoods.controller;

import com.unihack8.backend.neighbourhoods.domain.dto.NeighbourhoodPulseResponse;
import com.unihack8.backend.neighbourhoods.service.NeighbourhoodPulseService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Public Neighbourhood Pulse endpoint (docs/API.md -> Neighbourhoods). */
@RestController
@RequestMapping("/neighbourhoods")
public class NeighbourhoodController {

    private final NeighbourhoodPulseService pulse;

    // Delegates to the pulse service.
    public NeighbourhoodController(NeighbourhoodPulseService pulse) {
        this.pulse = pulse;
    }

    // GET /neighbourhoods/pulse — every area's live card, busiest first.
    @GetMapping("/pulse")
    public NeighbourhoodPulseResponse pulse() {
        return pulse.pulse();
    }
}
