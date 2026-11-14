package com.unihack8.backend.ai.service.impl;

import com.unihack8.backend.ai.domain.dto.LeaveNowDto;
import com.unihack8.backend.ai.service.LeaveNowService;
import com.unihack8.backend.common.exception.ApiException;
import com.unihack8.backend.common.geo.BoundingBox;
import com.unihack8.backend.common.geo.GeoPoint;
import com.unihack8.backend.routing.domain.dto.RouteLegResponse;
import com.unihack8.backend.routing.domain.dto.RoutePlanResponse;
import com.unihack8.backend.transit.domain.dto.ArrivalDto;
import com.unihack8.backend.transit.domain.dto.TransitStopDto;
import com.unihack8.backend.transit.service.TransitService;
import java.text.Normalizer;
import java.time.Duration;
import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import org.springframework.stereotype.Service;

/**
 * Finds the first ride of a route, the STPT stop it starts from and the first vehicle of that line the user can
 * still reach on foot; falls back to the route planner's own departure when STPT's arrivals are unavailable.
 */
@Service
public class LeaveNowServiceImpl implements LeaveNowService {

    /** The planner's boarding stop and STPT's stop are the same stop when this close (same line). */
    static final double STOP_MATCH_METERS = 150;
    /** Without a line match, only a stop this close counts as the same one. */
    static final double STOP_MATCH_ANY_LINE_METERS = 40;
    /** Spare time at the stop, so "leave now" is not a run. */
    static final Duration SPARE = Duration.ofMinutes(1);
    /** An arrival this far in the past is gone; ignore it. */
    private static final Duration GONE = Duration.ofSeconds(60);
    private static final double METERS_PER_DEGREE_LAT = 111_320;

    private final TransitService transit;

    // Live arrivals and stops come from the transit service (task 9).
    public LeaveNowServiceImpl(TransitService transit) {
        this.transit = transit;
    }

    // First ride of the route -> its STPT stop -> the first reachable arrival of that line, or the planner's time.
    @Override
    public Optional<LeaveNowDto> leaveNow(RoutePlanResponse plan, Instant now) {
        if (plan == null || plan.legs() == null) {
            return Optional.empty();
        }
        int ride = firstRide(plan.legs());
        if (ride < 0) {
            return Optional.empty();
        }
        RouteLegResponse leg = plan.legs().get(ride);
        Duration walk = walkBefore(plan.legs(), ride);
        Instant reachStopAt = now.plus(walk).plus(SPARE);

        List<ArrivalDto> arrivals = lineArrivals(leg, now);
        Optional<ArrivalDto> catchable = arrivals.stream()
                .filter(a -> !a.arrivesAt().isBefore(reachStopAt))
                .findFirst();
        Instant missed = arrivals.stream()
                .map(ArrivalDto::arrivesAt)
                .filter(at -> at.isBefore(reachStopAt))
                .reduce((first, second) -> second)
                .orElse(null);

        Instant boardAt;
        String source;
        if (catchable.isPresent()) {
            boardAt = catchable.get().arrivesAt();
            source = catchable.get().live() ? LeaveNowDto.SOURCE_LIVE : LeaveNowDto.SOURCE_TIMETABLE;
        } else if (leg.startsAt() != null) {
            boardAt = leg.startsAt();
            source = LeaveNowDto.SOURCE_PLAN;
        } else {
            return Optional.empty();
        }
        Instant leaveAt = boardAt.minus(walk).minus(SPARE);
        if (leaveAt.isBefore(now)) {
            leaveAt = now;
        }
        long walkMinutes = (walk.getSeconds() + 59) / 60;
        String stopName = leg.from() == null ? null : leg.from().name();
        return Optional.of(new LeaveNowDto(leg.route(), leg.mode(), leg.headsign(), stopName, walkMinutes,
                boardAt, leaveAt, source, missed));
    }

    // Index of the first tram/trolleybus/bus leg, or -1 for a walking-only route.
    static int firstRide(List<RouteLegResponse> legs) {
        for (int i = 0; i < legs.size(); i++) {
            String mode = legs.get(i).mode();
            if (mode != null && !"WALK".equalsIgnoreCase(mode) && legs.get(i).route() != null) {
                return i;
            }
        }
        return -1;
    }

    // Walking time from the start to the first ride (the legs before it are walks).
    static Duration walkBefore(List<RouteLegResponse> legs, int ride) {
        Duration total = Duration.ZERO;
        for (int i = 0; i < ride; i++) {
            RouteLegResponse leg = legs.get(i);
            if (leg.startsAt() != null && leg.endsAt() != null) {
                total = total.plus(Duration.between(leg.startsAt(), leg.endsAt()));
            } else {
                total = total.plusMinutes(leg.durationMinutes());
            }
        }
        return total;
    }

    // Upcoming arrivals of the ride's line at its STPT stop, soonest first (same direction when STPT names it the
    // same way); empty when the stop is not found or STPT is unavailable.
    private List<ArrivalDto> lineArrivals(RouteLegResponse leg, Instant now) {
        if (leg.from() == null) {
            return List.of();
        }
        try {
            Optional<TransitStopDto> stop = matchStop(new GeoPoint(leg.from().lat(), leg.from().lon()), leg.route());
            if (stop.isEmpty()) {
                return List.of();
            }
            List<ArrivalDto> ofLine = transit.arrivals(stop.get().id()).arrivals().stream()
                    .filter(a -> a.route() != null && a.route().equalsIgnoreCase(leg.route()))
                    .filter(a -> !a.arrivesAt().isBefore(now.minus(GONE)))
                    .sorted(Comparator.comparing(ArrivalDto::arrivesAt))
                    .toList();
            String direction = normalize(leg.headsign());
            List<ArrivalDto> sameDirection = ofLine.stream()
                    .filter(a -> direction != null && direction.equals(normalize(a.headsign())))
                    .toList();
            return sameDirection.isEmpty() ? ofLine : sameDirection;
        } catch (ApiException e) {
            return List.of();
        }
    }

    // The STPT stop at the planner's boarding point: the nearest one serving the line, else a very close one.
    Optional<TransitStopDto> matchStop(GeoPoint point, String line) {
        List<TransitStopDto> near = transit.stops(around(point, STOP_MATCH_METERS));
        Comparator<TransitStopDto> byDistance = Comparator.comparingDouble(s -> distance(point, s));
        Optional<TransitStopDto> serving = near.stream()
                .filter(s -> distance(point, s) <= STOP_MATCH_METERS)
                .filter(s -> s.routes() != null && s.routes().stream().anyMatch(r -> r.equalsIgnoreCase(line)))
                .min(byDistance);
        if (serving.isPresent()) {
            return serving;
        }
        return near.stream().filter(s -> distance(point, s) <= STOP_MATCH_ANY_LINE_METERS).min(byDistance);
    }

    // Square box of about `meters` around a point.
    static BoundingBox around(GeoPoint point, double meters) {
        double dLat = meters / METERS_PER_DEGREE_LAT;
        double dLon = meters / (METERS_PER_DEGREE_LAT * Math.cos(Math.toRadians(point.lat())));
        return new BoundingBox(point.lon() - dLon, point.lat() - dLat, point.lon() + dLon, point.lat() + dLat);
    }

    // Meters from a point to a stop.
    private static double distance(GeoPoint point, TransitStopDto stop) {
        return point.distanceMetersTo(new GeoPoint(stop.lat(), stop.lon()));
    }

    // Lower case without diacritics, so "Piața" and "Piata" compare equal; null for blank text.
    static String normalize(String text) {
        if (text == null || text.isBlank()) {
            return null;
        }
        String plain = Normalizer.normalize(text, Normalizer.Form.NFD).replaceAll("\\p{M}", "");
        return plain.trim().toLowerCase(Locale.ROOT);
    }
}
