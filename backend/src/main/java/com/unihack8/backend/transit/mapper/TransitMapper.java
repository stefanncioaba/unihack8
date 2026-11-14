package com.unihack8.backend.transit.mapper;

import com.unihack8.backend.transit.domain.dto.AlertDto;
import com.unihack8.backend.transit.domain.dto.ArrivalDto;
import com.unihack8.backend.transit.domain.dto.TransitRouteDto;
import com.unihack8.backend.transit.domain.dto.TransitShapeDto;
import com.unihack8.backend.transit.domain.dto.TransitStopDto;
import com.unihack8.backend.transit.domain.dto.VehicleDto;
import com.unihack8.backend.transit.domain.dto.stpt.StptAlert;
import com.unihack8.backend.transit.domain.dto.stpt.StptArrival;
import com.unihack8.backend.transit.domain.dto.stpt.StptRoute;
import com.unihack8.backend.transit.domain.dto.stpt.StptStop;
import com.unihack8.backend.transit.domain.dto.stpt.StptVehicle;
import com.unihack8.backend.transit.domain.model.RouteShape;
import java.time.Instant;
import java.util.List;

/** Turns STPT's raw shapes into the shapes of docs/API.md -> Transit. */
public interface TransitMapper {

    // Line with its type (TRAM, TROLLEYBUS, ...), end stations and colour.
    TransitRouteDto toRoute(StptRoute route);

    // Stop as shown on the map.
    TransitStopDto toStop(StptStop stop);

    // Live vehicle with lon instead of lng and a real timestamp; line facts (type, colour) from line,
    // which may be null when the line is unknown or STPT's line list is down.
    VehicleDto toVehicle(StptVehicle vehicle, TransitRouteDto line);

    // Line path with encoded polylines and per-path direction, headsign and stops; type/colour from STPT's line
    // when known, else from the GTFS file.
    TransitShapeDto toShape(RouteShape shape, TransitRouteDto line);

    // The same shape without the stop lists (the all-lines answer stays small).
    TransitShapeDto withoutStops(TransitShapeDto shape);

    // One STPT arrival line becomes one item per time; "HH:mm" (Romanian time) is turned into UTC.
    List<ArrivalDto> toArrivals(StptArrival arrival, Instant now);

    // Alert with title/description names.
    AlertDto toAlert(StptAlert alert);
}
