package com.unihack8.backend.transit.domain.dto.stpt;

import java.util.List;

/**
 * One line's upcoming arrivals at a stop, from /proxy-smtt-cache.php?stopid=.
 *
 * @param times     "HH:mm|minutes" in Romanian local time, e.g. "20:40|5"
 * @param vehicleId set when the first time comes from a tracked vehicle, null for timetable times
 */
public record StptArrival(String route, String type, String destination, String vehicleId, List<String> times) {
}
