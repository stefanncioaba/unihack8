package com.unihack8.backend.transit.domain.dto.stpt;

/** One live vehicle from /gtfs-vehicles.php; timestamp is epoch milliseconds. */
public record StptVehicle(String id, double lat, double lng, Double bearing, Double speed, String route,
                          String headsign, String stop, Long timestamp, Boolean isAccessible) {
}
