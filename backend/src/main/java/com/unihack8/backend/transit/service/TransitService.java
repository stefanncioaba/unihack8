package com.unihack8.backend.transit.service;

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
import java.util.List;
import java.util.Locale;

/**
 * Live public transport (PLAN task 9). Every method serves cached STPT data; when STPT is down
 * it serves the last cached value, or answers 503 SOURCE_UNAVAILABLE when nothing is cached.
 */
public interface TransitService {

    // All lines, trams first.
    List<TransitRouteDto> routes();

    // All stops, or only those inside the map viewport when bbox is given.
    List<TransitStopDto> stops(BoundingBox bbox);

    // Live vehicles of one line, or of every line when route is null/blank.
    VehiclesResponse vehicles(String route);

    // Drawn path of every line (or only one when route is given), from the GTFS file; empty without it.
    List<TransitShapeDto> shapes(String route);

    // Next arrivals at a stop; 404 for an unknown stop.
    ArrivalsResponse arrivals(String stopId);

    // Current service alerts.
    List<AlertDto> alerts();

    // Last known departure per line and direction from a stop.
    LastDeparturesResponse lastDepartures(String stopId);

    // Home page line for the stop nearest to the caller, in English or Romanian.
    TransitSummaryResponse summary(GeoPoint near, Locale locale);
}
