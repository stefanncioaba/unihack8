package com.unihack8.backend.ai.tool.impl;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.unihack8.backend.ai.domain.ToolContext;
import com.unihack8.backend.ai.domain.dto.LeaveNowDto;
import com.unihack8.backend.ai.service.LeaveNowService;
import com.unihack8.backend.ai.tool.ToolException;
import com.unihack8.backend.common.dto.PageResponse;
import com.unihack8.backend.common.exception.ApiException;
import com.unihack8.backend.common.exception.ErrorCode;
import com.unihack8.backend.common.geo.GeoPoint;
import com.unihack8.backend.events.domain.dto.EventSummary;
import com.unihack8.backend.events.service.EventService;
import com.unihack8.backend.routing.domain.dto.RouteLegResponse;
import com.unihack8.backend.routing.domain.dto.RoutePlaceResponse;
import com.unihack8.backend.routing.domain.dto.RoutePlanResponse;
import com.unihack8.backend.routing.domain.model.TravelMode;
import com.unihack8.backend.routing.service.RoutingService;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;

/** plan_route and search_events with mocked services. */
class PlanRouteAndEventsToolTest {

    private static final Instant NOW = Instant.parse("2026-11-14T16:00:00Z");
    private static final GeoPoint USER = new GeoPoint(45.7537, 21.2257);

    private final RoutingService routing = mock(RoutingService.class);
    private final LeaveNowService leaveNow = mock(LeaveNowService.class);
    private final EventService events = mock(EventService.class);

    // "Leave now" for a trip from the user: in the tool answer for the model and remembered for the route card.
    @Test
    @SuppressWarnings("unchecked")
    void leaveNowForATripFromTheUser() {
        RoutePlanResponse transit = plan("TRANSIT");
        when(routing.plan(eq(USER), any(), eq(TravelMode.TRANSIT), eq(NOW))).thenReturn(transit);
        LeaveNowDto leave = new LeaveNowDto("1", "TRAM", "Gara de Nord", "Piața Libertății", 4,
                Instant.parse("2026-11-14T16:11:00Z"), Instant.parse("2026-11-14T16:06:00Z"), LeaveNowDto.SOURCE_LIVE,
                Instant.parse("2026-11-14T16:03:00Z"));
        when(leaveNow.leaveNow(transit, NOW)).thenReturn(Optional.of(leave));
        ToolContext context = new ToolContext(USER, NOW);

        Map<String, Object> answer = new PlanRouteTool(routing, leaveNow).execute(Map.of("to_lat", 45.7505, "to_lon", 21.2075), context);

        assertThat((Map<String, Object>) answer.get("leave_now")).containsEntry("vehicle", "tram")
                .containsEntry("line", "1").containsEntry("stop", "Piața Libertății")
                .containsEntry("board_at", "18:11").containsEntry("leave_in_minutes", 6L)
                .containsEntry("time_is", "live (tracked vehicle)").containsEntry("too_late_for", "18:03");
        assertThat(context.routes()).singleElement().satisfies(route -> assertThat(route.leaveNow()).isEqualTo(leave));
    }

    // No "leave now" for a route from another place, or for a trip at a later time.
    @Test
    void noLeaveNowWhenNotLeavingNowFromTheUser() {
        when(routing.plan(any(), any(), any(), any())).thenReturn(plan("TRANSIT"));
        ToolContext context = new ToolContext(USER, NOW);
        PlanRouteTool tool = new PlanRouteTool(routing, leaveNow);

        Map<String, Object> fromElsewhere = tool.execute(Map.of("from_lat", 45.7472, "from_lon", 21.2310,
                "to_lat", 45.7505, "to_lon", 21.2075), context);
        Map<String, Object> later = tool.execute(Map.of("to_lat", 45.7505, "to_lon", 21.2075,
                "depart_at", "2026-11-15T09:00"), context);

        assertThat(fromElsewhere).doesNotContainKey("leave_now");
        assertThat(later).doesNotContainKey("leave_now");
        assertThat(context.routes()).allSatisfy(route -> assertThat(route.leaveNow()).isNull());
        verify(leaveNow, never()).leaveNow(any(), any());
    }

    // A transit route is summarised with local times and its steps (no polylines).
    @Test
    @SuppressWarnings("unchecked")
    void transitRoute() {
        when(routing.plan(eq(USER), any(), eq(TravelMode.TRANSIT), eq(NOW))).thenReturn(plan("TRANSIT"));
        Map<String, Object> answer = new PlanRouteTool(routing, leaveNow)
                .execute(Map.of("to_lat", 45.7505, "to_lon", 21.2075), new ToolContext(USER, NOW));

        assertThat(answer).containsEntry("mode", "TRANSIT").containsEntry("total_minutes", 18L)
                .containsEntry("leave_at", "18:02").containsEntry("arrive_at", "18:20");
        List<Map<String, Object>> steps = (List<Map<String, Object>>) answer.get("steps");
        assertThat(steps.get(1)).containsEntry("mode", "tram").containsEntry("line", "1").containsEntry("from", "Piața Libertății");
        assertThat(steps.get(1)).doesNotContainKey("polyline");
    }

    // OTP down for TRANSIT: the walking route is used, with a note.
    @Test
    void transitDownFallsBackToWalking() {
        when(routing.plan(any(), any(), eq(TravelMode.TRANSIT), any()))
                .thenThrow(new ApiException(ErrorCode.SOURCE_UNAVAILABLE));
        when(routing.plan(any(), any(), eq(TravelMode.WALK), any())).thenReturn(plan("WALK"));
        Map<String, Object> answer = new PlanRouteTool(routing, leaveNow)
                .execute(Map.of("to_lat", 45.75, "to_lon", 21.20, "mode", "TRANSIT"), new ToolContext(USER, NOW));
        assertThat(answer).containsEntry("mode", "WALK").containsKey("note");
    }

    // Every planned route is remembered for routes[]: from the user when no start is given (PLAN 18.2, 18.3).
    @Test
    void remembersRouteFromTheUser() {
        when(routing.plan(eq(USER), any(), eq(TravelMode.TRANSIT), eq(NOW))).thenReturn(plan("TRANSIT"));
        ToolContext context = new ToolContext(USER, NOW);
        Map<String, Object> answer = new PlanRouteTool(routing, leaveNow).execute(Map.of("to_lat", 45.7505, "to_lon", 21.2075), context);

        assertThat(answer).containsEntry("from", "user location");
        assertThat(context.routes()).singleElement().satisfies(route -> {
            assertThat(route.startsFromUser()).isTrue();
            assertThat(route.from()).isEqualTo(USER);
            assertThat(route.to()).isEqualTo(new GeoPoint(45.7505, 21.2075));
            assertThat(route.mode()).isEqualTo("TRANSIT");
            assertThat(route.durationMinutes()).isEqualTo(18);
            assertThat(route.distanceMeters()).isEqualTo(3400);
        });
    }

    // A route from another place (the university) is remembered with startsFromUser = false.
    @Test
    void remembersRouteFromAnotherPlace() {
        GeoPoint university = new GeoPoint(45.7472, 21.2310);
        when(routing.plan(eq(university), any(), eq(TravelMode.WALK), eq(NOW))).thenReturn(plan("WALK"));
        ToolContext context = new ToolContext(USER, NOW);
        Map<String, Object> answer = new PlanRouteTool(routing, leaveNow).execute(Map.of("from_lat", 45.7472, "from_lon", 21.2310,
                "to_lat", 45.7505, "to_lon", 21.2075, "mode", "WALK"), context);

        assertThat(answer).containsEntry("from", "given point");
        assertThat(context.routes()).singleElement().satisfies(route -> {
            assertThat(route.startsFromUser()).isFalse();
            assertThat(route.from()).isEqualTo(university);
        });
    }

    // Without the user's location the route starts at the city centre and never counts as "from the user".
    @Test
    void noLocationIsNotFromTheUser() {
        when(routing.plan(eq(ToolContext.CITY_CENTRE), any(), any(), any())).thenReturn(plan("WALK"));
        ToolContext context = new ToolContext(null, NOW);
        Map<String, Object> answer = new PlanRouteTool(routing, leaveNow).execute(Map.of("to_lat", 45.7505, "to_lon", 21.2075), context);
        assertThat(answer.get("from").toString()).startsWith("city centre");
        assertThat(context.routes()).singleElement().satisfies(route -> assertThat(route.startsFromUser()).isFalse());
    }

    // The destination is required.
    @Test
    void destinationRequired() {
        assertThatThrownBy(() -> new PlanRouteTool(routing, leaveNow).execute(Map.of(), new ToolContext(USER, NOW)))
                .isInstanceOf(ToolException.class);
    }

    // "This weekend" window in local time, radius filter, local start times, remembered cards.
    @Test
    @SuppressWarnings("unchecked")
    void eventsInWindow() {
        EventSummary near = event("Jazz Night", 45.7540, 21.2260, "USER");
        EventSummary far = event("Airport Party", 45.81, 21.33, "EXTERNAL");
        when(events.search(isNull(), eq(List.of("CONCERT")), any(), any(), isNull(), isNull(), eq(0), eq(100)))
                .thenReturn(new PageResponse<>(List.of(near, far), 0, 100, 2, 1));
        ToolContext context = new ToolContext(USER, NOW);

        Map<String, Object> answer = new SearchEventsTool(events).execute(Map.of("categories", List.of("concert"),
                "from", "2026-11-14", "to", "2026-11-15", "radius_meters", 3000), context);

        List<Map<String, Object>> found = (List<Map<String, Object>>) answer.get("events");
        assertThat(found).extracting(e -> e.get("title")).containsExactly("Jazz Night");
        assertThat(found.getFirst()).containsEntry("starts", "Sat 14 Nov 2026, 21:00")
                .containsEntry("price_lei", "40.00").containsEntry("spots_left", 3);
        assertThat(answer).containsEntry("window_end", "Sun 15 Nov 2026, 23:59");
        assertThat(context.events()).containsExactly(near);
        // "from" in the past is moved to now.
        verify(events).search(isNull(), eq(List.of("CONCERT")), eq(NOW), eq(Instant.parse("2026-11-15T21:59:59Z")),
                isNull(), isNull(), eq(0), eq(100));
    }

    // Unknown categories are reported to the model.
    @Test
    void eventsBadCategory() {
        assertThatThrownBy(() -> new SearchEventsTool(events).execute(Map.of("categories", "opera"), new ToolContext(USER, NOW)))
                .isInstanceOf(ToolException.class);
    }

    // Route like the routing fixture: walk, then tram 1.
    private static RoutePlanResponse plan(String mode) {
        RoutePlaceResponse start = new RoutePlaceResponse("Start", 45.7537, 21.2257);
        RoutePlaceResponse stop = new RoutePlaceResponse("Piața Libertății", 45.7550, 21.2280);
        RoutePlaceResponse end = new RoutePlaceResponse("Gara de Nord", 45.7505, 21.2075);
        return new RoutePlanResponse(mode, 18, 3400, Instant.parse("2026-11-14T16:02:00Z"),
                Instant.parse("2026-11-14T16:20:00Z"), false, List.of(
                new RouteLegResponse("WALK", null, null, start, stop, Instant.parse("2026-11-14T16:02:00Z"),
                        Instant.parse("2026-11-14T16:06:00Z"), 4, "abc"),
                new RouteLegResponse("TRAM", "1", "Gara de Nord", stop, end, Instant.parse("2026-11-14T16:08:00Z"),
                        Instant.parse("2026-11-14T16:20:00Z"), 12, "def")));
    }

    // Event on Saturday 19:00 UTC (21:00 local).
    private static EventSummary event(String title, double lat, double lon, String source) {
        return new EventSummary(UUID.randomUUID(), source, title, "CONCERT", "Venue", lat, lon,
                Instant.parse("2026-11-14T19:00:00Z"), null, null, new BigDecimal("40.00"), new BigDecimal("40.00"), 10, 3, null, 0);
    }
}
