package com.unihack8.backend.ai.tool.impl;

import com.unihack8.backend.ai.domain.ToolContext;
import com.unihack8.backend.ai.tool.AiTool;
import com.unihack8.backend.ai.tool.ToolArgs;
import com.unihack8.backend.ai.tool.ToolException;
import com.unihack8.backend.common.exception.ApiException;
import com.unihack8.backend.common.geo.GeoPoint;
import com.unihack8.backend.common.text.TextMatch;
import com.unihack8.backend.transit.domain.dto.AlertDto;
import com.unihack8.backend.transit.domain.dto.ArrivalsResponse;
import com.unihack8.backend.transit.domain.dto.LastDeparturesResponse;
import com.unihack8.backend.transit.domain.dto.TransitRouteDto;
import com.unihack8.backend.transit.domain.dto.TransitStopDto;
import java.util.Locale;
import java.util.function.Predicate;
import java.util.stream.Collectors;
import com.unihack8.backend.transit.service.TransitService;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Component;

/**
 * transit_info (PLAN 11.2): live STPT data for the stops near a point or with a given name — next
 * arrivals, last departures of the day ("last tram") and current service alerts.
 */
@Component
public class TransitInfoTool implements AiTool {

    static final int STOPS = 2;
    static final int ARRIVALS_PER_STOP = 6;
    static final List<String> VEHICLE_TYPES = List.of("TRAM", "TROLLEYBUS", "BUS", "EXPRESS", "METROPOLITAN", "BOAT");

    private final TransitService transitService;

    // Needs the transit service (task 9).
    public TransitInfoTool(TransitService transitService) {
        this.transitService = transitService;
    }

    // Tool name used by the model.
    @Override
    public String name() {
        return "transit_info";
    }

    // Parameters: an optional stop name and an optional point (default the user).
    @Override
    public Map<String, Object> declaration() {
        Map<String, Object> properties = new LinkedHashMap<>();
        properties.put("stop_name", Map.of("type", "string",
                "description", "Optional stop name or part of it, e.g. \"Piata Victoriei\" or \"Gara de Nord\"."));
        properties.put("near_lat", Map.of("type", "number", "description", "Look for stops near this point; default = the user."));
        properties.put("near_lon", Map.of("type", "number", "description", "Look for stops near this point; default = the user."));
        properties.put("line", Map.of("type", "string", "description", "Optional line to focus on, e.g. \"1\" or \"E2\"."));
        properties.put("vehicle_type", Map.of("type", "string", "enum", VEHICLE_TYPES,
                "description", "Optional: only stops and departures of this kind, e.g. TRAM for \"last tram\"."));
        return Map.of(
                "name", name(),
                "description", "Public transport in Timisoara (STPT trams, trolleybuses, buses): the nearest stops "
                        + "(or stops with a given name), their next live arrivals, the last departure of each line "
                        + "today (\"last tram\") and current service alerts. Times are Romanian local time.",
                "parameters", Map.of("type", "object", "properties", properties));
    }

    // Finds the stops, then reads arrivals, last departures and alerts for them.
    @Override
    public Map<String, Object> execute(Map<String, Object> args, ToolContext context) {
        GeoPoint centre = ToolArgs.point(args, "near");
        GeoPoint near = centre == null ? context.origin() : centre;
        String stopName = ToolArgs.text(args, "stop_name");
        String line = ToolArgs.text(args, "line");
        String vehicleText = ToolArgs.text(args, "vehicle_type");
        String vehicle = vehicleText == null ? null : vehicleText.toUpperCase(Locale.ROOT);
        if (vehicle != null && !VEHICLE_TYPES.contains(vehicle)) {
            throw new ToolException("vehicle_type must be one of " + VEHICLE_TYPES);
        }

        List<TransitStopDto> allStops;
        try {
            allStops = transitService.stops(null);
        } catch (ApiException e) {
            throw new ToolException("Live transit data is not available right now.");
        }
        Map<String, String> types = lineTypes();
        // A line counts when it matches the requested line and vehicle type (when given).
        Predicate<String> wantedLine = route -> (line == null || line.equalsIgnoreCase(route))
                && (vehicle == null || vehicle.equals(types.get(route)));
        String wanted = stopName == null ? null : TextMatch.normalize(stopName);
        List<TransitStopDto> stops = allStops.stream()
                .filter(s -> wanted == null || TextMatch.normalize(s.name()).contains(wanted))
                .filter(s -> (line == null && vehicle == null)
                        || (s.routes() != null && s.routes().stream().anyMatch(wantedLine)))
                .sorted(Comparator.comparingDouble(s -> near.distanceMetersTo(new GeoPoint(s.lat(), s.lon()))))
                .limit(STOPS)
                .toList();

        Map<String, Object> answer = new LinkedHashMap<>();
        answer.put("now", ToolArgs.localTime(context.now()));
        answer.put("stops", stops.stream().map(s -> describe(s, near, wantedLine, types)).toList());
        if (stops.isEmpty()) {
            answer.put("hint", "No stop matched. Try another stop name, or leave stop_name empty for the "
                    + "nearest stops (vehicle_type still applies).");
        }
        answer.put("alerts", alerts());
        return answer;
    }

    // One stop with its next arrivals and last departures; every line is labelled TRAM, TROLLEYBUS, BUS...
    private Map<String, Object> describe(TransitStopDto stop, GeoPoint near, Predicate<String> wantedLine,
                                         Map<String, String> types) {
        Map<String, Object> view = new LinkedHashMap<>();
        int meters = (int) Math.round(near.distanceMetersTo(new GeoPoint(stop.lat(), stop.lon())));
        view.put("stop_id", stop.id());
        view.put("name", stop.name());
        view.put("distance_meters", meters);
        view.put("walk_minutes", ToolArgs.walkMinutes(meters));
        view.put("lines", stop.routes() == null ? List.of()
                : stop.routes().stream().map(r -> r + " (" + types.getOrDefault(r, "?") + ")").toList());
        try {
            ArrivalsResponse arrivals = transitService.arrivals(stop.id());
            view.put("next_arrivals", arrivals.arrivals().stream()
                    .filter(a -> wantedLine.test(a.route()))
                    .limit(ARRIVALS_PER_STOP)
                    .map(a -> Map.of("line", a.route(), "type", types.getOrDefault(a.route(), "unknown"),
                            "towards", String.valueOf(a.headsign()),
                            "in_minutes", a.minutes(), "at", ToolArgs.localClock(a.arrivesAt()),
                            "live", a.live()))
                    .toList());
            if (arrivals.stale()) {
                view.put("arrivals_note", "STPT did not answer; these are the last known arrivals");
            }
        } catch (ApiException e) {
            view.put("next_arrivals", "unavailable");
        }
        try {
            LastDeparturesResponse last = transitService.lastDepartures(stop.id());
            view.put("last_departures_today", last.departures().stream()
                    .filter(d -> wantedLine.test(d.route()))
                    .map(d -> Map.of("line", d.route(), "type", types.getOrDefault(d.route(), "unknown"),
                            "towards", String.valueOf(d.headsign()),
                            "at", ToolArgs.localClock(d.lastDepartureAt())))
                    .toList());
            view.put("last_departures_source", "TIMETABLE".equals(last.source())
                    ? "timetable" : "estimate from live arrivals (not the real end of service)");
        } catch (ApiException e) {
            view.put("last_departures_today", "unavailable");
        }
        return view;
    }

    // Line id -> TRAM, TROLLEYBUS, BUS, EXPRESS, METROPOLITAN or BOAT; empty when STPT is down.
    private Map<String, String> lineTypes() {
        try {
            return transitService.routes().stream()
                    .collect(Collectors.toMap(TransitRouteDto::id, TransitRouteDto::type, (a, b) -> a));
        } catch (ApiException e) {
            return Map.of();
        }
    }

    // Titles of the current service alerts (max 5), or a note when unavailable.
    private Object alerts() {
        try {
            return transitService.alerts().stream().limit(5).map(AlertDto::title).toList();
        } catch (ApiException e) {
            return "unavailable";
        }
    }
}
