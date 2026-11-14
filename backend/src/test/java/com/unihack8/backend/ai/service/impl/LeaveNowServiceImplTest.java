package com.unihack8.backend.ai.service.impl;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.unihack8.backend.ai.domain.dto.LeaveNowDto;
import com.unihack8.backend.common.exception.ApiException;
import com.unihack8.backend.common.exception.ErrorCode;
import com.unihack8.backend.common.geo.BoundingBox;
import com.unihack8.backend.common.geo.GeoPoint;
import com.unihack8.backend.routing.domain.dto.RouteLegResponse;
import com.unihack8.backend.routing.domain.dto.RoutePlaceResponse;
import com.unihack8.backend.routing.domain.dto.RoutePlanResponse;
import com.unihack8.backend.transit.domain.dto.ArrivalDto;
import com.unihack8.backend.transit.domain.dto.ArrivalsResponse;
import com.unihack8.backend.transit.domain.dto.TransitStopDto;
import com.unihack8.backend.transit.service.TransitService;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;

/** "Leave now": which tram/bus the user can still catch and when to leave, from mocked STPT data. */
class LeaveNowServiceImplTest {

    private static final Instant NOW = Instant.parse("2026-11-14T18:00:00Z");
    // Boarding stop as the route planner names it, and the STPT stop 20 m away.
    private static final RoutePlaceResponse START = new RoutePlaceResponse("Start", 45.7537, 21.2257);
    private static final RoutePlaceResponse STOP = new RoutePlaceResponse("Piața Libertății", 45.7550, 21.2280);
    private static final RoutePlaceResponse END = new RoutePlaceResponse("Gara de Nord", 45.7505, 21.2075);
    private static final TransitStopDto STPT_STOP =
            new TransitStopDto("42", "Piața Libertății", 45.75515, 21.22815, List.of("1", "8"));

    private final TransitService transit = mock(TransitService.class);
    private final LeaveNowServiceImpl service = new LeaveNowServiceImpl(transit);

    // Walk 4 min, tram 1 tracked at 18:09: leave at 18:04 (4 min walk + 1 spare minute), source LIVE.
    @Test
    void catchesTheFirstReachableTrackedTram() {
        stopsNear(STPT_STOP);
        arrivals(arrival("1", "Gara de Nord", 9, true), arrival("8", "Gara de Nord", 6, true));

        LeaveNowDto leave = service.leaveNow(plan(4), NOW).orElseThrow();

        assertThat(leave.line()).isEqualTo("1");
        assertThat(leave.vehicleType()).isEqualTo("TRAM");
        assertThat(leave.stopName()).isEqualTo("Piața Libertății");
        assertThat(leave.walkMinutes()).isEqualTo(4);
        assertThat(leave.boardAt()).isEqualTo(NOW.plus(Duration.ofMinutes(9)));
        assertThat(leave.leaveAt()).isEqualTo(NOW.plus(Duration.ofMinutes(4)));
        assertThat(leave.source()).isEqualTo(LeaveNowDto.SOURCE_LIVE);
        assertThat(leave.missedBoardAt()).isNull();
    }

    // "Will I make it?": the tram in 3 min leaves before the user can reach the stop, so the next one is chosen.
    @Test
    void skipsATramTheUserCannotReach() {
        stopsNear(STPT_STOP);
        arrivals(arrival("1", "Gara de Nord", 3, true), arrival("1", "Gara de Nord", 15, false));

        LeaveNowDto leave = service.leaveNow(plan(4), NOW).orElseThrow();

        assertThat(leave.boardAt()).isEqualTo(NOW.plus(Duration.ofMinutes(15)));
        assertThat(leave.leaveAt()).isEqualTo(NOW.plus(Duration.ofMinutes(10)));
        assertThat(leave.source()).isEqualTo(LeaveNowDto.SOURCE_TIMETABLE);
        assertThat(leave.missedBoardAt()).isEqualTo(NOW.plus(Duration.ofMinutes(3)));
    }

    // Exactly enough time: walk 4 + 1 spare = tram in 5 min -> leave now.
    @Test
    void leaveNowWhenJustInTime() {
        stopsNear(STPT_STOP);
        arrivals(arrival("1", "Gara de Nord", 5, true));

        LeaveNowDto leave = service.leaveNow(plan(4), NOW).orElseThrow();

        assertThat(leave.leaveAt()).isEqualTo(NOW);
        assertThat(leave.missedBoardAt()).isNull();
    }

    // The same line in the other direction at the same stop is not used when the direction is known.
    @Test
    void prefersTheRouteDirection() {
        stopsNear(STPT_STOP);
        arrivals(arrival("1", "Calea Buziașului", 7, true), arrival("1", "Gara de Nord", 12, true));

        LeaveNowDto leave = service.leaveNow(plan(4), NOW).orElseThrow();

        assertThat(leave.boardAt()).isEqualTo(NOW.plus(Duration.ofMinutes(12)));
    }

    // Diacritics do not matter when matching the direction ("Piata" = "Piața").
    @Test
    void directionIgnoresDiacritics() {
        assertThat(LeaveNowServiceImpl.normalize("  Piața Domășneanu ")).isEqualTo("piata domasneanu");
        assertThat(LeaveNowServiceImpl.normalize(" ")).isNull();
    }

    // STPT down: the route planner's own departure is used (source PLAN).
    @Test
    void stptDownUsesThePlannedDeparture() {
        when(transit.stops(any())).thenThrow(new ApiException(ErrorCode.SOURCE_UNAVAILABLE));

        LeaveNowDto leave = service.leaveNow(plan(4), NOW).orElseThrow();

        assertThat(leave.source()).isEqualTo(LeaveNowDto.SOURCE_PLAN);
        assertThat(leave.boardAt()).isEqualTo(NOW.plus(Duration.ofMinutes(8)));
        assertThat(leave.leaveAt()).isEqualTo(NOW.plus(Duration.ofMinutes(3)));
    }

    // No STPT stop near the boarding point: planned departure, arrivals never asked for.
    @Test
    void noMatchingStopUsesThePlannedDeparture() {
        stopsNear(new TransitStopDto("99", "Far away", 45.7600, 21.2400, List.of("1")));

        LeaveNowDto leave = service.leaveNow(plan(4), NOW).orElseThrow();

        assertThat(leave.source()).isEqualTo(LeaveNowDto.SOURCE_PLAN);
        verify(transit, never()).arrivals(any());
    }

    // A stop that does not list the line only counts when it is right at the boarding point.
    @Test
    void stopWithoutTheLineMustBeVeryClose() {
        TransitStopDto otherLines = new TransitStopDto("7", "Piața Libertății", 45.7551, 21.2281, List.of("8"));
        stopsNear(otherLines);
        assertThat(service.matchStop(new GeoPoint(STOP.lat(), STOP.lon()), "1")).contains(otherLines);

        TransitStopDto otherLinesFurther = new TransitStopDto("8", "Other", 45.7558, 21.2280, List.of("8"));
        stopsNear(otherLinesFurther);
        assertThat(service.matchStop(new GeoPoint(STOP.lat(), STOP.lon()), "1")).isEmpty();
    }

    // A walking-only route has no "leave now".
    @Test
    void walkingRouteHasNone() {
        RoutePlanResponse walk = new RoutePlanResponse("WALK", 12, 900, NOW, NOW.plusSeconds(720), false,
                List.of(new RouteLegResponse("WALK", null, null, START, END, NOW, NOW.plusSeconds(720), 12, "x")));
        assertThat(service.leaveNow(walk, NOW)).isEmpty();
    }

    // The search box around the stop is about 150 m on each side.
    @Test
    void boxAroundTheStop() {
        BoundingBox box = LeaveNowServiceImpl.around(new GeoPoint(45.75, 21.22), 150);
        assertThat(box.contains(45.7513, 21.2219)).isTrue();
        assertThat(box.contains(45.7520, 21.22)).isFalse();
    }

    // Walk `walkMinutes` from now to the stop, tram 1 planned 8 min from now, 12 min ride.
    private static RoutePlanResponse plan(int walkMinutes) {
        Instant atStop = NOW.plus(Duration.ofMinutes(walkMinutes));
        Instant board = NOW.plus(Duration.ofMinutes(8));
        return new RoutePlanResponse("TRANSIT", 20, 3400, NOW, board.plus(Duration.ofMinutes(12)), false, List.of(
                new RouteLegResponse("WALK", null, null, START, STOP, NOW, atStop, walkMinutes, "a"),
                new RouteLegResponse("TRAM", "1", "Gara de Nord", STOP, END, board, board.plus(Duration.ofMinutes(12)), 12, "b")));
    }

    // STPT stops returned for the box around the boarding point.
    private void stopsNear(TransitStopDto... stops) {
        when(transit.stops(any())).thenReturn(List.of(stops));
    }

    // STPT arrivals at stop 42.
    private void arrivals(ArrivalDto... arrivals) {
        when(transit.arrivals("42")).thenReturn(new ArrivalsResponse("42", "Piața Libertății", NOW, false, List.of(arrivals)));
    }

    // An arrival `minutes` from now.
    private static ArrivalDto arrival(String line, String headsign, int minutes, boolean live) {
        return new ArrivalDto(line, headsign, NOW.plus(Duration.ofMinutes(minutes)), minutes, live);
    }
}
