package com.unihack8.backend.transit.repository;

import com.unihack8.backend.transit.domain.model.ScheduledDeparture;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

/**
 * The STPT timetable (GTFS file from task 10), used for "last tram/bus" answers (PLAN 9.6).
 * Read-only; the file is loaded once, on first use.
 */
public interface TimetableRepository {

    // Last departure of every line and direction from the stop on that service day.
    // Empty Optional when there is no timetable file or the date is outside the timetable's range,
    // so the caller can fall back to live data.
    Optional<List<ScheduledDeparture>> lastDepartures(String stopId, LocalDate serviceDate);

    // Stop name from the timetable (used when STPT's live stop list is down).
    Optional<String> stopName(String stopId);
}
