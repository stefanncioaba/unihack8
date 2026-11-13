package com.unihack8.backend.routing.mapper;

import com.unihack8.backend.routing.domain.dto.RoutePlanResponse;
import com.unihack8.backend.common.geo.GeoPoint;
import com.unihack8.backend.routing.domain.otp.OtpPlanResult;
import java.time.Instant;

/** Turns OpenTripPlanner answers (or a straight-line estimate) into the API's route shape. */
public interface RoutePlanMapper {

    // Maps one OTP itinerary to the response; mode is TRANSIT when any leg rides a vehicle.
    RoutePlanResponse toResponse(OtpPlanResult.Itinerary itinerary);

    // Straight-line walking estimate used when OTP cannot answer (fallback = true).
    RoutePlanResponse walkingEstimate(GeoPoint from, GeoPoint to, Instant departAt);
}
