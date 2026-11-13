package com.unihack8.backend.routing.service.impl;

import com.unihack8.backend.common.exception.ApiException;
import com.unihack8.backend.common.exception.ErrorCode;
import com.unihack8.backend.routing.client.OtpClient;
import com.unihack8.backend.routing.client.OtpUnavailableException;
import com.unihack8.backend.routing.domain.dto.RoutePlanResponse;
import com.unihack8.backend.routing.domain.model.GeoPoint;
import com.unihack8.backend.routing.domain.model.TravelMode;
import com.unihack8.backend.routing.domain.otp.OtpPlanResult;
import com.unihack8.backend.routing.mapper.RoutePlanMapper;
import com.unihack8.backend.routing.service.RoutingService;
import java.time.Clock;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.Comparator;
import java.util.List;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * Asks OpenTripPlanner for the route and falls back so the demo never shows an error for walking (PLAN 10.4):
 * <ul>
 *   <li>WALK, OTP down or no route found: straight-line walking estimate ({@code fallback: true}).</li>
 *   <li>TRANSIT, OTP down: 503 SOURCE_UNAVAILABLE (the app then offers walking).</li>
 *   <li>TRANSIT, no trip found (e.g. no service at night or GTFS missing): the walking route instead.</li>
 * </ul>
 */
@Service
public class RoutingServiceImpl implements RoutingService {

    private static final Logger log = LoggerFactory.getLogger(RoutingServiceImpl.class);

    private final OtpClient otp;
    private final RoutePlanMapper mapper;
    private final Clock clock;

    // Dependencies: OTP client, response mapper and the shared clock (for "now").
    public RoutingServiceImpl(OtpClient otp, RoutePlanMapper mapper, Clock clock) {
        this.otp = otp;
        this.mapper = mapper;
        this.clock = clock;
    }

    // Plans the route, applying the fallback rules from the class comment.
    @Override
    public RoutePlanResponse plan(GeoPoint from, GeoPoint to, TravelMode mode, Instant departAt) {
        Instant departure = departAt != null ? departAt : clock.instant();
        if (mode == TravelMode.TRANSIT) {
            List<OtpPlanResult.Itinerary> itineraries;
            try {
                itineraries = otp.plan(from, to, TravelMode.TRANSIT, departure);
            } catch (OtpUnavailableException e) {
                log.warn("OpenTripPlanner unavailable for a transit route: {}", e.getMessage());
                throw new ApiException(ErrorCode.SOURCE_UNAVAILABLE,
                        "Public transport directions are not available right now. Try walking.");
            }
            if (!itineraries.isEmpty()) {
                return mapper.toResponse(best(itineraries));
            }
        }
        return planWalk(from, to, departure);
    }

    // Itinerary that arrives first (shorter trip on a tie). OTP's own order can put a slower
    // direct walk before a faster tram/bus trip, so we never just take the first one.
    static OtpPlanResult.Itinerary best(List<OtpPlanResult.Itinerary> itineraries) {
        Comparator<OtpPlanResult.Itinerary> byArrival = Comparator.comparing(
                (OtpPlanResult.Itinerary it) -> it.end() == null ? Instant.MAX : OffsetDateTime.parse(it.end()).toInstant());
        Comparator<OtpPlanResult.Itinerary> byDuration = Comparator.comparing(
                (OtpPlanResult.Itinerary it) -> it.duration() == null ? Long.MAX_VALUE : it.duration());
        return itineraries.stream().min(byArrival.thenComparing(byDuration)).orElseThrow();
    }

    // Walking route from OTP, or the straight-line estimate when OTP cannot give one.
    private RoutePlanResponse planWalk(GeoPoint from, GeoPoint to, Instant departure) {
        try {
            List<OtpPlanResult.Itinerary> itineraries = otp.plan(from, to, TravelMode.WALK, departure);
            if (!itineraries.isEmpty()) {
                return mapper.toResponse(best(itineraries));
            }
        } catch (OtpUnavailableException e) {
            log.warn("OpenTripPlanner unavailable, using straight-line walking estimate: {}", e.getMessage());
        }
        return mapper.walkingEstimate(from, to, departure);
    }
}
