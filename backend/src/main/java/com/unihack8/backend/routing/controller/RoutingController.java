package com.unihack8.backend.routing.controller;

import com.unihack8.backend.routing.domain.dto.RoutePlanResponse;
import com.unihack8.backend.common.geo.GeoPoint;
import com.unihack8.backend.routing.domain.model.TravelMode;
import com.unihack8.backend.routing.service.RoutingService;
import java.time.Instant;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Directions endpoint (docs/API.md, Routing). Needs a token. */
@RestController
@RequestMapping("/routes")
public class RoutingController {

    private final RoutingService routing;

    // Uses the routing service for all logic.
    public RoutingController(RoutingService routing) {
        this.routing = routing;
    }

    // GET /routes/plan?from=lat,lon&to=lat,lon&mode=WALK|TRANSIT[&departAt=ISO time]
    @GetMapping("/plan")
    public RoutePlanResponse plan(
            @RequestParam String from,
            @RequestParam String to,
            @RequestParam TravelMode mode,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant departAt) {
        return routing.plan(GeoPoint.parse(from, "from"), GeoPoint.parse(to, "to"), mode, departAt);
    }
}
