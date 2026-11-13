package com.unihack8.backend.reliability.controller;

import com.unihack8.backend.reliability.domain.dto.ReliabilityResponse;
import com.unihack8.backend.reliability.service.ReliabilityService;
import java.util.UUID;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

/** GET /users/{id}/reliability (PLAN 6.4; docs/API.md). Any signed-in user may view any profile's history. */
@RestController
public class ReliabilityController {

    private final ReliabilityService reliability;

    // Needs the reliability service.
    public ReliabilityController(ReliabilityService reliability) {
        this.reliability = reliability;
    }

    // Score and the 20 most recent changes.
    @GetMapping("/users/{id}/reliability")
    public ReliabilityResponse history(@PathVariable UUID id) {
        return reliability.history(id);
    }
}
