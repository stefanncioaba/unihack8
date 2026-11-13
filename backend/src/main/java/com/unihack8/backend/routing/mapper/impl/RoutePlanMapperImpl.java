package com.unihack8.backend.routing.mapper.impl;

import com.unihack8.backend.routing.domain.dto.RouteLegResponse;
import com.unihack8.backend.routing.domain.dto.RoutePlaceResponse;
import com.unihack8.backend.routing.domain.dto.RoutePlanResponse;
import com.unihack8.backend.routing.domain.model.GeoPoint;
import com.unihack8.backend.routing.domain.model.TravelMode;
import com.unihack8.backend.routing.domain.otp.OtpPlanResult;
import com.unihack8.backend.routing.mapper.RoutePlanMapper;
import com.unihack8.backend.routing.util.PolylineEncoder;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.temporal.ChronoUnit;
import java.util.List;
import org.springframework.stereotype.Component;

/** Hand-written mapper from OTP's GraphQL shape to RoutePlanResponse. */
@Component
public class RoutePlanMapperImpl implements RoutePlanMapper {

    static final String WALK = "WALK";

    // Average walking speed: 4.8 km/h.
    static final double WALKING_SPEED_METERS_PER_SECOND = 4.8 / 3.6;

    // Streets are never straight: real walking distance is about 25% longer than the straight line.
    static final double DETOUR_FACTOR = 1.25;

    // Maps one OTP itinerary; durations and distances are rounded to whole minutes and meters.
    @Override
    public RoutePlanResponse toResponse(OtpPlanResult.Itinerary itinerary) {
        List<OtpPlanResult.Leg> otpLegs = itinerary.legs() == null ? List.of() : itinerary.legs();
        List<RouteLegResponse> legs = otpLegs.stream().map(this::toLeg).toList();
        boolean usesTransit = legs.stream().anyMatch(leg -> !WALK.equals(leg.mode()));
        double distance = otpLegs.stream()
                .mapToDouble(leg -> leg.distance() == null ? 0 : leg.distance())
                .sum();
        long seconds = itinerary.duration() == null ? 0 : itinerary.duration();
        return new RoutePlanResponse(
                usesTransit ? TravelMode.TRANSIT.name() : TravelMode.WALK.name(),
                minutes(seconds),
                Math.round(distance),
                parseTime(itinerary.start()),
                parseTime(itinerary.end()),
                false,
                legs);
    }

    // Straight-line distance x detour factor at walking speed, as a single WALK leg.
    @Override
    public RoutePlanResponse walkingEstimate(GeoPoint from, GeoPoint to, Instant departAt) {
        double distance = from.distanceMetersTo(to) * DETOUR_FACTOR;
        long seconds = Math.round(distance / WALKING_SPEED_METERS_PER_SECOND);
        Instant start = departAt.truncatedTo(ChronoUnit.SECONDS);
        Instant end = start.plusSeconds(seconds);
        long durationMinutes = minutes(seconds);
        RouteLegResponse leg = new RouteLegResponse(
                WALK, null, null,
                new RoutePlaceResponse("Start", from.lat(), from.lon()),
                new RoutePlaceResponse("Destination", to.lat(), to.lon()),
                start, end, durationMinutes,
                PolylineEncoder.encode(List.of(from, to)));
        return new RoutePlanResponse(
                TravelMode.WALK.name(), durationMinutes, Math.round(distance), start, end, true, List.of(leg));
    }

    // One OTP leg; route and headsign only for vehicle legs.
    private RouteLegResponse toLeg(OtpPlanResult.Leg leg) {
        String mode = legMode(leg.mode());
        boolean walking = WALK.equals(mode);
        long seconds = leg.duration() == null ? 0 : Math.round(leg.duration());
        return new RouteLegResponse(
                mode,
                walking || leg.route() == null ? null : leg.route().shortName(),
                walking ? null : leg.headsign(),
                place(leg.from()),
                place(leg.to()),
                leg.start() == null ? null : parseTime(leg.start().scheduledTime()),
                leg.end() == null ? null : parseTime(leg.end().scheduledTime()),
                minutes(seconds),
                leg.legGeometry() == null ? null : leg.legGeometry().points());
    }

    // OTP mode -> our leg mode (WALK, TRAM, TROLLEYBUS, BUS); other vehicles count as BUS.
    static String legMode(String otpMode) {
        if (otpMode == null || WALK.equals(otpMode)) {
            return WALK;
        }
        return switch (otpMode) {
            case "TRAM", "TROLLEYBUS", "BUS" -> otpMode;
            default -> "BUS";
        };
    }

    // OTP place -> our place (missing coordinates become 0, which OTP never sends in practice).
    private static RoutePlaceResponse place(OtpPlanResult.Place place) {
        if (place == null) {
            return null;
        }
        return new RoutePlaceResponse(
                place.name(),
                place.lat() == null ? 0 : place.lat(),
                place.lon() == null ? 0 : place.lon());
    }

    // Seconds -> whole minutes, at least 1 for any non-empty trip so the app never shows "0 min".
    static long minutes(long seconds) {
        if (seconds <= 0) {
            return 0;
        }
        return Math.max(1, Math.round(seconds / 60.0));
    }

    // OTP sends times with the local offset (e.g. +02:00); we answer in UTC.
    private static Instant parseTime(String value) {
        return value == null ? null : OffsetDateTime.parse(value).toInstant();
    }
}
