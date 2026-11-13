package com.unihack8.backend.routing.client;

import com.unihack8.backend.routing.domain.model.GeoPoint;
import com.unihack8.backend.routing.domain.model.TravelMode;
import com.unihack8.backend.routing.domain.otp.OtpPlanResult;
import java.time.Instant;
import java.util.List;

/** Asks OpenTripPlanner 2 for routes. Only the backend calls OTP; the app never does. */
public interface OtpClient {

    /**
     * Itineraries from {@code from} to {@code to}, leaving at {@code departAt}, in OTP's order
     * (not always fastest first: the caller picks).
     * Empty when OTP found no route (e.g. a point outside the map).
     *
     * @throws OtpUnavailableException when OTP is down, slow or answers with an error
     */
    List<OtpPlanResult.Itinerary> plan(GeoPoint from, GeoPoint to, TravelMode mode, Instant departAt);
}
