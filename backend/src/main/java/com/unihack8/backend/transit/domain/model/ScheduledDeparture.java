package com.unihack8.backend.transit.domain.model;

/**
 * Last timetabled departure of one line and direction from a stop on a service day.
 *
 * @param route            line name as passengers know it, e.g. "2"
 * @param headsign         where the vehicle is going, e.g. "Shopping City"
 * @param departureSeconds seconds after the service day's midnight; may exceed 24 h for after-midnight trips
 */
public record ScheduledDeparture(String route, String headsign, int departureSeconds) {
}
