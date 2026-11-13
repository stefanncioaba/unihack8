package com.unihack8.backend.transit.domain.dto.stpt;

import java.util.List;

/** One stop as STPT sends it in /gtfs-data/stops-index.json. */
public record StptStop(String stopCode, String stopName, double lat, double lon, List<String> routes) {
}
