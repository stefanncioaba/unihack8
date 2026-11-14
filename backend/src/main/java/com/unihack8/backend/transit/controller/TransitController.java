package com.unihack8.backend.transit.controller;

import com.unihack8.backend.common.geo.BoundingBox;
import com.unihack8.backend.common.geo.GeoPoint;
import com.unihack8.backend.transit.domain.dto.AlertDto;
import com.unihack8.backend.transit.domain.dto.ArrivalsResponse;
import com.unihack8.backend.transit.domain.dto.LastDeparturesResponse;
import com.unihack8.backend.transit.domain.dto.TransitRouteDto;
import com.unihack8.backend.transit.domain.dto.TransitShapeDto;
import com.unihack8.backend.transit.domain.dto.TransitStopDto;
import com.unihack8.backend.transit.domain.dto.TransitSummaryResponse;
import com.unihack8.backend.transit.domain.dto.VehiclesResponse;
import com.unihack8.backend.transit.service.TransitService;
import java.util.List;
import java.util.Locale;
import org.springframework.http.HttpHeaders;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Public live-transit endpoints (docs/API.md -> Transit, PLAN task 9). */
@RestController
@RequestMapping("/transit")
public class TransitController {

    private final TransitService transit;

    // Delegates everything to the transit service.
    public TransitController(TransitService transit) {
        this.transit = transit;
    }

    // GET /transit/routes — every line.
    @GetMapping("/routes")
    public List<TransitRouteDto> routes() {
        return transit.routes();
    }

    // GET /transit/stops?bbox= — stops, optionally only in the map viewport.
    @GetMapping("/stops")
    public List<TransitStopDto> stops(@RequestParam(required = false) String bbox) {
        return transit.stops(bbox == null || bbox.isBlank() ? null : BoundingBox.parse(bbox, "bbox"));
    }

    // GET /transit/vehicles?route= — live vehicles of one line, or of every line without route.
    @GetMapping("/vehicles")
    public VehiclesResponse vehicles(@RequestParam(required = false) String route) {
        return transit.vehicles(route);
    }

    // GET /transit/shapes?route= — drawn path of every line (or of one line).
    @GetMapping("/shapes")
    public List<TransitShapeDto> shapes(@RequestParam(required = false) String route) {
        return transit.shapes(route);
    }

    // GET /transit/stops/{id}/arrivals — next arrivals at a stop.
    @GetMapping("/stops/{id}/arrivals")
    public ArrivalsResponse arrivals(@PathVariable String id) {
        return transit.arrivals(id);
    }

    // GET /transit/alerts — current service alerts.
    @GetMapping("/alerts")
    public List<AlertDto> alerts() {
        return transit.alerts();
    }

    // GET /transit/last-departures?stopId= — last departure per line from a stop.
    @GetMapping("/last-departures")
    public LastDeparturesResponse lastDepartures(@RequestParam String stopId) {
        return transit.lastDepartures(stopId);
    }

    // GET /transit/summary?near=lat,lon — home page line; language from Accept-Language.
    @GetMapping("/summary")
    public TransitSummaryResponse summary(@RequestParam String near,
                                          @RequestHeader(value = HttpHeaders.ACCEPT_LANGUAGE, required = false)
                                          String acceptLanguage) {
        return transit.summary(GeoPoint.parse(near, "near"), language(acceptLanguage));
    }

    // Romanian when the caller's first preferred language is "ro", otherwise English (docs/API.md).
    static Locale language(String acceptLanguage) {
        boolean romanian = acceptLanguage != null
                && acceptLanguage.trim().toLowerCase(Locale.ROOT).startsWith("ro");
        return romanian ? Locale.of("ro") : Locale.ENGLISH;
    }
}
