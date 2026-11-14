package com.unihack8.backend.transit.repository;

import com.unihack8.backend.transit.domain.model.RouteShape;
import java.util.List;

/**
 * Drawn paths of every line, read from the STPT GTFS file (shapes.txt, or stop sequences when a
 * trip has no shape). Read-only; the file is loaded once, on first use.
 */
public interface ShapeRepository {

    // Every line's paths; empty when there is no timetable file.
    List<RouteShape> shapes();
}
