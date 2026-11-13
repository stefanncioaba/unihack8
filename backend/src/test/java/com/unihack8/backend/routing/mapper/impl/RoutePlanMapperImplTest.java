package com.unihack8.backend.routing.mapper.impl;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

import com.unihack8.backend.routing.support.OtpFixtures;
import com.unihack8.backend.routing.domain.dto.RouteLegResponse;
import com.unihack8.backend.routing.domain.dto.RoutePlanResponse;
import com.unihack8.backend.common.geo.GeoPoint;
import com.unihack8.backend.routing.domain.otp.OtpPlanResult;
import com.unihack8.backend.routing.util.PolylineEncoder;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;

/** OTP itinerary -> API shape, and the straight-line walking estimate. */
public class RoutePlanMapperImplTest {

    private final RoutePlanMapperImpl mapper = new RoutePlanMapperImpl();

    // Hand-built walk + tram itinerary with round numbers, matching the example in docs/API.md
    // (real OTP answers are in support/OtpFixtures).
    public static OtpPlanResult.Itinerary transitItinerary() {
        OtpPlanResult.Leg walk = new OtpPlanResult.Leg("WALK", null, 240.0, 310.4,
                new OtpPlanResult.Place("Start", 45.7537, 21.2257),
                new OtpPlanResult.Place("Piața Libertății", 45.755, 21.228),
                new OtpPlanResult.LegTime("2026-11-14T20:02:00+02:00"),
                new OtpPlanResult.LegTime("2026-11-14T20:06:00+02:00"),
                null, new OtpPlanResult.Geometry("a~l~Fjk~uOwHJy@P"));
        OtpPlanResult.Leg tram = new OtpPlanResult.Leg("TRAM", "Gara de Nord", 720.0, 3089.7,
                new OtpPlanResult.Place("Piața Libertății", 45.755, 21.228),
                new OtpPlanResult.Place("Gara de Nord", 45.7505, 21.2075),
                new OtpPlanResult.LegTime("2026-11-14T20:08:00+02:00"),
                new OtpPlanResult.LegTime("2026-11-14T20:20:00+02:00"),
                new OtpPlanResult.Route("1"), new OtpPlanResult.Geometry("u~l~Fjk~uOwHJy@Pq@d@"));
        return new OtpPlanResult.Itinerary("2026-11-14T20:02:00+02:00", "2026-11-14T20:20:00+02:00",
                1080L, List.of(walk, tram));
    }

    // Transit itinerary: totals, UTC times, legs; walking legs have no route/headsign.
    @Test
    void mapsTransitItinerary() {
        RoutePlanResponse plan = mapper.toResponse(transitItinerary());

        assertThat(plan.mode()).isEqualTo("TRANSIT");
        assertThat(plan.durationMinutes()).isEqualTo(18);
        assertThat(plan.distanceMeters()).isEqualTo(3400);
        assertThat(plan.startsAt()).isEqualTo(Instant.parse("2026-11-14T18:02:00Z"));
        assertThat(plan.endsAt()).isEqualTo(Instant.parse("2026-11-14T18:20:00Z"));
        assertThat(plan.fallback()).isFalse();
        assertThat(plan.legs()).hasSize(2);

        RouteLegResponse walk = plan.legs().get(0);
        assertThat(walk.mode()).isEqualTo("WALK");
        assertThat(walk.route()).isNull();
        assertThat(walk.headsign()).isNull();
        assertThat(walk.durationMinutes()).isEqualTo(4);
        assertThat(walk.from().name()).isEqualTo("Start");

        RouteLegResponse tram = plan.legs().get(1);
        assertThat(tram.mode()).isEqualTo("TRAM");
        assertThat(tram.route()).isEqualTo("1");
        assertThat(tram.headsign()).isEqualTo("Gara de Nord");
        assertThat(tram.to().lat()).isEqualTo(45.7505);
        assertThat(tram.startsAt()).isEqualTo(Instant.parse("2026-11-14T18:08:00Z"));
        assertThat(tram.durationMinutes()).isEqualTo(12);
        assertThat(tram.polyline()).isEqualTo("u~l~Fjk~uOwHJy@Pq@d@");
    }

    // Real OTP answer: trolleybus itinerary maps with Romanian stop names and UTC times.
    @Test
    void mapsRealOtpItinerary() {
        RoutePlanResponse plan = mapper.toResponse(OtpFixtures.itineraries(OtpFixtures.TRANSIT).get(1));

        assertThat(plan.mode()).isEqualTo("TRANSIT");
        assertThat(plan.durationMinutes()).isEqualTo(11);
        assertThat(plan.distanceMeters()).isEqualTo(1491);
        assertThat(plan.startsAt()).isEqualTo(Instant.parse("2026-11-16T08:02:26Z"));
        assertThat(plan.endsAt()).isEqualTo(Instant.parse("2026-11-16T08:13:39Z"));
        assertThat(plan.legs()).extracting(RouteLegResponse::mode).containsExactly("WALK", "TROLLEYBUS", "WALK");
        RouteLegResponse ride = plan.legs().get(1);
        assertThat(ride.route()).isEqualTo("18");
        assertThat(ride.headsign()).isEqualTo("Gheorghe Barițiu");
        assertThat(ride.to().name()).isEqualTo("Gara de Nord");
        assertThat(ride.durationMinutes()).isEqualTo(4);
        assertThat(PolylineEncoder.decode(ride.polyline()).getFirst().lat()).isCloseTo(45.7529, within(0.001));
    }

    // An itinerary with only walking legs is reported as WALK.
    @Test
    void walkOnlyItineraryIsWalk() {
        OtpPlanResult.Itinerary full = transitItinerary();
        OtpPlanResult.Itinerary walkOnly = new OtpPlanResult.Itinerary(
                full.start(), full.end(), 300L, List.of(full.legs().getFirst()));

        assertThat(mapper.toResponse(walkOnly).mode()).isEqualTo("WALK");
    }

    // OTP modes we do not show separately count as BUS.
    @Test
    void legModes() {
        assertThat(RoutePlanMapperImpl.legMode("WALK")).isEqualTo("WALK");
        assertThat(RoutePlanMapperImpl.legMode(null)).isEqualTo("WALK");
        assertThat(RoutePlanMapperImpl.legMode("TROLLEYBUS")).isEqualTo("TROLLEYBUS");
        assertThat(RoutePlanMapperImpl.legMode("RAIL")).isEqualTo("BUS");
    }

    // Rounding to minutes: 0 stays 0, anything short is at least 1.
    @Test
    void minutesRounding() {
        assertThat(RoutePlanMapperImpl.minutes(0)).isZero();
        assertThat(RoutePlanMapperImpl.minutes(10)).isEqualTo(1);
        assertThat(RoutePlanMapperImpl.minutes(89)).isEqualTo(1);
        assertThat(RoutePlanMapperImpl.minutes(91)).isEqualTo(2);
    }

    // Straight-line estimate: one WALK leg between the two points, flagged as fallback.
    @Test
    void walkingEstimate() {
        GeoPoint from = new GeoPoint(45.7537, 21.2257);
        GeoPoint to = new GeoPoint(45.7505, 21.2075);
        Instant departAt = Instant.parse("2026-11-14T18:00:00.500Z");

        RoutePlanResponse plan = mapper.walkingEstimate(from, to, departAt);

        double expectedMeters = from.distanceMetersTo(to) * RoutePlanMapperImpl.DETOUR_FACTOR;
        assertThat(plan.fallback()).isTrue();
        assertThat(plan.mode()).isEqualTo("WALK");
        assertThat(plan.distanceMeters()).isEqualTo(Math.round(expectedMeters));
        // ~1.85 km at 4.8 km/h is about 23 minutes.
        assertThat(plan.durationMinutes()).isBetween(21L, 25L);
        assertThat(plan.startsAt()).isEqualTo(Instant.parse("2026-11-14T18:00:00Z"));
        assertThat(plan.endsAt()).isAfter(plan.startsAt());
        assertThat(plan.legs()).singleElement().satisfies(leg -> {
            assertThat(leg.mode()).isEqualTo("WALK");
            assertThat(leg.from().name()).isEqualTo("Start");
            assertThat(leg.to().name()).isEqualTo("Destination");
            assertThat(PolylineEncoder.decode(leg.polyline())).containsExactly(from, to);
        });
    }
}
