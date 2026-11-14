package com.unihack8.backend.transit.domain.dto;

import java.util.List;

/**
 * GET /transit/shapes item: the drawn path of one line.
 *
 * @param route     line id, same as GET /transit/routes id
 * @param type      TRAM, TROLLEYBUS, BUS, EXPRESS, METROPOLITAN or BOAT
 * @param color     line colour, e.g. "#e3a900" (null when unknown)
 * @param polylines Google encoded polylines (precision 5), one per direction/variant
 */
public record TransitShapeDto(String route, String routeName, String type, String color, List<String> polylines) {
}
