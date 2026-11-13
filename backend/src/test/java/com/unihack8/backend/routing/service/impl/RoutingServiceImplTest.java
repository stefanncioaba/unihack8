package com.unihack8.backend.routing.service.impl;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.unihack8.backend.common.exception.ApiException;
import com.unihack8.backend.common.exception.ErrorCode;
import com.unihack8.backend.routing.client.OtpClient;
import com.unihack8.backend.routing.client.OtpUnavailableException;
import com.unihack8.backend.routing.domain.dto.RoutePlanResponse;
import com.unihack8.backend.routing.domain.model.GeoPoint;
import com.unihack8.backend.routing.domain.model.TravelMode;
import com.unihack8.backend.routing.mapper.impl.RoutePlanMapperImpl;
import com.unihack8.backend.routing.domain.otp.OtpPlanResult;
import com.unihack8.backend.routing.mapper.impl.RoutePlanMapperImplTest;
import com.unihack8.backend.routing.support.OtpFixtures;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

/** Fallback rules of the routing service (PLAN 10.4), with a mocked OTP client. */
class RoutingServiceImplTest {

    private static final GeoPoint FROM = new GeoPoint(45.7537, 21.2257);
    private static final GeoPoint TO = new GeoPoint(45.7505, 21.2075);
    private static final Instant NOW = Instant.parse("2026-11-14T18:00:00Z");

    private OtpClient otp;
    private RoutingServiceImpl service;

    // Real mapper, mocked OTP, fixed clock.
    @BeforeEach
    void setUp() {
        otp = mock(OtpClient.class);
        service = new RoutingServiceImpl(otp, new RoutePlanMapperImpl(), Clock.fixed(NOW, ZoneOffset.UTC));
    }

    // TRANSIT with an OTP answer returns its best itinerary; no departAt means now.
    @Test
    void transitReturnsBestItinerary() {
        when(otp.plan(FROM, TO, TravelMode.TRANSIT, NOW))
                .thenReturn(List.of(RoutePlanMapperImplTest.transitItinerary()));

        RoutePlanResponse plan = service.plan(FROM, TO, TravelMode.TRANSIT, null);

        assertThat(plan.mode()).isEqualTo("TRANSIT");
        assertThat(plan.fallback()).isFalse();
        verify(otp, never()).plan(any(), any(), eq(TravelMode.WALK), any());
    }

    // Real OTP answer lists a slower direct walk first: we return trolleybus 18, which arrives first.
    @Test
    void picksEarliestArrivalNotOtpOrder() {
        when(otp.plan(FROM, TO, TravelMode.TRANSIT, NOW)).thenReturn(OtpFixtures.itineraries(OtpFixtures.TRANSIT));

        RoutePlanResponse plan = service.plan(FROM, TO, TravelMode.TRANSIT, null);

        assertThat(plan.mode()).isEqualTo("TRANSIT");
        assertThat(plan.endsAt()).isEqualTo(Instant.parse("2026-11-16T08:13:39Z"));
        assertThat(plan.legs().get(1).route()).isEqualTo("18");
    }

    // Same arrival time: the shorter trip wins.
    @Test
    void sameArrivalPrefersShorterTrip() {
        var a = new OtpPlanResult.Itinerary("2026-11-16T10:00:00+02:00", "2026-11-16T10:20:00+02:00", 1200L, List.of());
        var b = new OtpPlanResult.Itinerary("2026-11-16T10:05:00+02:00", "2026-11-16T10:20:00+02:00", 900L, List.of());

        assertThat(RoutingServiceImpl.best(List.of(a, b))).isSameAs(b);
    }

    // TRANSIT while OTP is down -> 503 SOURCE_UNAVAILABLE.
    @Test
    void transitWithOtpDownIs503() {
        when(otp.plan(any(), any(), any(), any())).thenThrow(new OtpUnavailableException("down", null));

        assertThatThrownBy(() -> service.plan(FROM, TO, TravelMode.TRANSIT, null))
                .isInstanceOf(ApiException.class)
                .extracting(e -> ((ApiException) e).code())
                .isEqualTo(ErrorCode.SOURCE_UNAVAILABLE);
    }

    // TRANSIT with no trip found falls back to OTP's walking route.
    @Test
    void transitWithNoTripUsesWalking() {
        Instant departAt = Instant.parse("2026-11-15T01:30:00Z");
        var full = RoutePlanMapperImplTest.transitItinerary();
        var walkOnly = new OtpPlanResult.Itinerary(
                full.start(), full.end(), 300L, List.of(full.legs().getFirst()));
        when(otp.plan(FROM, TO, TravelMode.TRANSIT, departAt)).thenReturn(List.of());
        when(otp.plan(FROM, TO, TravelMode.WALK, departAt)).thenReturn(List.of(walkOnly));

        RoutePlanResponse plan = service.plan(FROM, TO, TravelMode.TRANSIT, departAt);

        assertThat(plan.mode()).isEqualTo("WALK");
        assertThat(plan.fallback()).isFalse();
    }

    // WALK while OTP is down -> straight-line estimate, never an error.
    @Test
    void walkWithOtpDownUsesStraightLine() {
        when(otp.plan(any(), any(), any(), any())).thenThrow(new OtpUnavailableException("down", null));

        RoutePlanResponse plan = service.plan(FROM, TO, TravelMode.WALK, null);

        assertThat(plan.fallback()).isTrue();
        assertThat(plan.mode()).isEqualTo("WALK");
        assertThat(plan.startsAt()).isEqualTo(NOW);
    }

    // WALK with no route found (e.g. outside the map) -> straight-line estimate.
    @Test
    void walkWithNoRouteUsesStraightLine() {
        when(otp.plan(FROM, TO, TravelMode.WALK, NOW)).thenReturn(List.of());

        assertThat(service.plan(FROM, TO, TravelMode.WALK, null).fallback()).isTrue();
    }

    // TRANSIT with no trip and OTP failing on the walking retry still answers with the estimate.
    @Test
    void transitNoTripThenOtpDownUsesStraightLine() {
        when(otp.plan(FROM, TO, TravelMode.TRANSIT, NOW)).thenReturn(List.of());
        when(otp.plan(FROM, TO, TravelMode.WALK, NOW)).thenThrow(new OtpUnavailableException("down", null));

        assertThat(service.plan(FROM, TO, TravelMode.TRANSIT, null).fallback()).isTrue();
    }
}
