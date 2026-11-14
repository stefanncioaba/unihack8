package com.unihack8.backend.ai.tool.impl;

import com.unihack8.backend.ai.domain.ToolContext;
import com.unihack8.backend.ai.tool.AiTool;
import com.unihack8.backend.ai.tool.ToolArgs;
import com.unihack8.backend.ai.tool.ToolException;
import com.unihack8.backend.common.exception.ApiException;
import com.unihack8.backend.common.exception.ErrorCode;
import com.unihack8.backend.common.geo.GeoPoint;
import com.unihack8.backend.routing.domain.dto.RouteLegResponse;
import com.unihack8.backend.routing.domain.dto.RoutePlanResponse;
import com.unihack8.backend.routing.domain.model.TravelMode;
import com.unihack8.backend.routing.service.RoutingService;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import org.springframework.stereotype.Component;

/** plan_route (PLAN 11.2): walking or walking + public transport directions with a time estimate. */
@Component
public class PlanRouteTool implements AiTool {

    private final RoutingService routingService;

    // Needs the routing service (task 10).
    public PlanRouteTool(RoutingService routingService) {
        this.routingService = routingService;
    }

    // Tool name used by the model.
    @Override
    public String name() {
        return "plan_route";
    }

    // Parameters: destination (required), optional start, mode and departure time.
    @Override
    public Map<String, Object> declaration() {
        Map<String, Object> properties = new LinkedHashMap<>();
        properties.put("to_lat", Map.of("type", "number", "description", "Destination latitude (e.g. from search_places)."));
        properties.put("to_lon", Map.of("type", "number", "description", "Destination longitude."));
        properties.put("from_lat", Map.of("type", "number", "description", "Start latitude. Leave out when the route starts at the user; give it only when the user asks for a route from somewhere else."));
        properties.put("from_lon", Map.of("type", "number", "description", "Start longitude; default = the user."));
        properties.put("mode", Map.of("type", "string", "enum", java.util.List.of("WALK", "TRANSIT"),
                "description", "WALK = walking only; TRANSIT = walking + tram/trolleybus/bus (default)."));
        properties.put("depart_at", Map.of("type", "string",
                "description", "Optional departure, Romanian local time, e.g. 2026-11-14T19:00. Default now."));
        return Map.of(
                "name", name(),
                "description", "Directions in Timisoara from the user (or a start point) to a destination: total "
                        + "minutes, distance, departure/arrival time and the steps (walk, tram/bus line, stops).",
                "parameters", Map.of("type", "object", "properties", properties, "required", java.util.List.of("to_lat", "to_lon")));
    }

    // Plans the route (remembered for the answer's routes[], PLAN 18.2); TRANSIT falls back to walking when the planner is down.
    @Override
    public Map<String, Object> execute(Map<String, Object> args, ToolContext context) {
        GeoPoint to = ToolArgs.point(args, "to");
        if (to == null) {
            throw new ToolException("to_lat and to_lon are required");
        }
        GeoPoint start = ToolArgs.point(args, "from");
        GeoPoint from = start == null ? context.origin() : start;
        String modeText = ToolArgs.text(args, "mode");
        TravelMode mode = "WALK".equalsIgnoreCase(modeText) ? TravelMode.WALK : TravelMode.TRANSIT;
        Instant departAt = ToolArgs.time(args, "depart_at", false);
        Instant when = departAt == null ? context.now() : departAt;

        Map<String, Object> answer = new LinkedHashMap<>();
        RoutePlanResponse plan;
        try {
            plan = routingService.plan(from, to, mode, when);
        } catch (ApiException e) {
            if (mode != TravelMode.TRANSIT || e.code() != ErrorCode.SOURCE_UNAVAILABLE) {
                throw new ToolException(e.getMessage());
            }
            plan = routingService.plan(from, to, TravelMode.WALK, when);
            answer.put("note", "Public transport planning is unavailable right now; this is the walking route.");
        }
        boolean fromUser = context.startsFromUser(start);
        context.rememberRoute(new ToolContext.PlannedRoute(from, to, plan.mode(), plan.durationMinutes(),
                plan.distanceMeters(), fromUser));
        answer.put("from", fromUser ? "user location"
                : start == null ? "city centre (user location unknown)" : "given point");
        answer.put("mode", plan.mode());
        answer.put("total_minutes", plan.durationMinutes());
        answer.put("distance_meters", plan.distanceMeters());
        answer.put("leave_at", ToolArgs.localClock(plan.startsAt()));
        answer.put("arrive_at", ToolArgs.localClock(plan.endsAt()));
        if (plan.fallback()) {
            answer.put("estimate", "straight-line walking estimate (route planner unavailable)");
        }
        answer.put("steps", plan.legs().stream().map(PlanRouteTool::leg).toList());
        return answer;
    }

    // One step of the route for the model.
    private static Map<String, Object> leg(RouteLegResponse leg) {
        Map<String, Object> view = new LinkedHashMap<>();
        view.put("mode", leg.mode().toLowerCase(Locale.ROOT));
        if (leg.route() != null) {
            view.put("line", leg.route());
            view.put("towards", leg.headsign());
        }
        view.put("from", leg.from() == null ? null : leg.from().name());
        view.put("to", leg.to() == null ? null : leg.to().name());
        view.put("depart", ToolArgs.localClock(leg.startsAt()));
        view.put("minutes", leg.durationMinutes());
        return view;
    }
}
