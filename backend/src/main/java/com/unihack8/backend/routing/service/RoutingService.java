package com.unihack8.backend.routing.service;

import com.unihack8.backend.routing.domain.dto.RoutePlanResponse;
import com.unihack8.backend.routing.domain.model.GeoPoint;
import com.unihack8.backend.routing.domain.model.TravelMode;
import java.time.Instant;

/** Directions between two points (PLAN task 10). */
public interface RoutingService {

    /**
     * Best route from {@code from} to {@code to}.
     * WALK always answers (straight-line estimate when OTP is down); TRANSIT answers
     * 503 SOURCE_UNAVAILABLE when OTP is down.
     *
     * @param departAt departure time; null means now
     */
    RoutePlanResponse plan(GeoPoint from, GeoPoint to, TravelMode mode, Instant departAt);
}
