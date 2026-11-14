package com.unihack8.backend.transit.domain.dto;

import java.util.List;

/**
 * One direction / variant of a line in GET /transit/shapes.
 *
 * @param polyline  Google encoded polyline (precision 5), same as the matching TransitShapeDto.polylines item
 * @param direction "TUR" (GTFS direction_id 0), "RETUR" (1) or null when the feed has no direction
 * @param headsign  where this direction is heading (its terminus), may be null
 * @param stops     the direction's stops in order; null in the all-lines answer (no route=) to keep it small
 */
public record ShapeVariantDto(String polyline, String direction, String headsign, List<ShapeStopDto> stops) {
}
