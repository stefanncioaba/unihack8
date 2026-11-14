package com.unihack8.backend.ai.domain.dto;

import java.time.Instant;

/**
 * "Leave now" for a public transport route that starts at the user (the "Leave now" box under the route card):
 * when to leave so the walk ends at the first stop in time for the first tram/bus.
 *
 * @param line          line of the first ride, e.g. "1"
 * @param vehicleType   TRAM, TROLLEYBUS or BUS
 * @param headsign      direction shown on the vehicle; null when unknown
 * @param stopName      the stop where the user gets on
 * @param walkMinutes   walk from the user to that stop
 * @param boardAt       when the vehicle the user can catch reaches the stop
 * @param leaveAt       when to start walking (boardAt minus the walk and one spare minute)
 * @param source        LIVE (tracked vehicle), TIMETABLE (STPT's scheduled time) or PLAN (route planner,
 *                      STPT arrivals unavailable)
 * @param missedBoardAt an earlier vehicle of the same line the user can no longer reach; null when none
 */
public record LeaveNowDto(String line, String vehicleType, String headsign, String stopName, long walkMinutes,
                          Instant boardAt, Instant leaveAt, String source, Instant missedBoardAt) {

    /** boardAt comes from a tracked vehicle. */
    public static final String SOURCE_LIVE = "LIVE";
    /** boardAt is STPT's scheduled arrival (no vehicle tracked yet). */
    public static final String SOURCE_TIMETABLE = "TIMETABLE";
    /** boardAt comes from the route planner because STPT's arrivals were unavailable. */
    public static final String SOURCE_PLAN = "PLAN";
}
