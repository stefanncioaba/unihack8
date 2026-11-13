package com.unihack8.backend.ai.tool.impl;

import com.unihack8.backend.ai.domain.ToolContext;
import com.unihack8.backend.ai.tool.AiTool;
import com.unihack8.backend.ai.tool.ToolArgs;
import com.unihack8.backend.ai.tool.ToolException;
import com.unihack8.backend.common.exception.ApiException;
import com.unihack8.backend.common.geo.GeoPoint;
import com.unihack8.backend.events.domain.dto.EventSummary;
import com.unihack8.backend.events.service.EventService;
import java.time.Instant;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.springframework.stereotype.Component;

/** search_events (PLAN 11.2): upcoming events from our database (imported and user-created). */
@Component
public class SearchEventsTool implements AiTool {

    static final List<String> CATEGORIES =
            List.of("PARTY", "CONCERT", "THEATRE", "SPORT", "GAMES", "FOOD", "ART", "MEETUP", "OTHER");
    static final int DEFAULT_LIMIT = 8;
    static final int MAX_LIMIT = 15;

    private final EventService eventService;

    // Needs the event service (task 5).
    public SearchEventsTool(EventService eventService) {
        this.eventService = eventService;
    }

    // Tool name used by the model.
    @Override
    public String name() {
        return "search_events";
    }

    // Parameters: text, categories, time window, optional radius, limit.
    @Override
    public Map<String, Object> declaration() {
        Map<String, Object> properties = new LinkedHashMap<>();
        properties.put("query", Map.of("type", "string",
                "description", "Optional words to find in the event title, e.g. \"jazz\" or \"stand-up\"."));
        properties.put("categories", Map.of("type", "array", "items", Map.of("type", "string", "enum", CATEGORIES),
                "description", "Event types; empty = all. Going out / party -> PARTY, CONCERT."));
        properties.put("from", Map.of("type", "string",
                "description", "Start of the window, Romanian local time: 2026-11-14 or 2026-11-14T18:00. Default now."));
        properties.put("to", Map.of("type", "string",
                "description", "End of the window, same format; a bare date means the end of that day."));
        properties.put("radius_meters", Map.of("type", "integer",
                "description", "Only events within this distance of the user (optional)."));
        properties.put("limit", Map.of("type", "integer", "description", "Max results, default 8, max 15."));
        return Map.of(
                "name", name(),
                "description", "Find upcoming events in Timisoara (concerts, parties, theatre, sport, meetups, "
                        + "events created by app users). Returns title, venue, local start/end time, price range "
                        + "in lei, free spots and distance from the user. Sorted by start time.",
                "parameters", Map.of("type", "object", "properties", properties));
    }

    // Runs the search and remembers the results for the answer cards.
    @Override
    public Map<String, Object> execute(Map<String, Object> args, ToolContext context) {
        List<String> categories = ToolArgs.texts(args, "categories").stream()
                .map(c -> c.toUpperCase(Locale.ROOT)).toList();
        for (String category : categories) {
            if (!CATEGORIES.contains(category)) {
                throw new ToolException("unknown category " + category);
            }
        }
        Instant from = ToolArgs.time(args, "from", false);
        Instant to = ToolArgs.time(args, "to", true);
        if (from == null || from.isBefore(context.now())) {
            from = context.now();
        }
        if (to != null && to.isBefore(from)) {
            throw new ToolException("to is before from");
        }
        Double radius = ToolArgs.number(args, "radius_meters");
        int limit = ToolArgs.integer(args, "limit", DEFAULT_LIMIT, 1, MAX_LIMIT);

        List<EventSummary> events;
        try {
            events = eventService.search(ToolArgs.text(args, "query"), categories.isEmpty() ? null : categories,
                    from, to, null, null, 0, 100).items();
        } catch (ApiException e) {
            throw new ToolException(e.getMessage());
        }
        List<Map<String, Object>> results = events.stream()
                .filter(e -> radius == null || (e.lat() != null && distance(e, context) <= radius))
                .sorted(Comparator.comparing(EventSummary::startsAt))
                .limit(limit)
                .map(e -> describe(e, context))
                .toList();

        Map<String, Object> answer = new LinkedHashMap<>();
        answer.put("window_start", ToolArgs.localTime(from));
        answer.put("window_end", to == null ? "open" : ToolArgs.localTime(to));
        answer.put("count", results.size());
        answer.put("events", results);
        if (results.isEmpty()) {
            answer.put("hint", "No events found. Try a longer time window or fewer filters.");
        }
        return answer;
    }

    // Compact view of one event for the model; also remembered for the response cards.
    private static Map<String, Object> describe(EventSummary event, ToolContext context) {
        context.rememberEvent(event);
        Map<String, Object> view = new LinkedHashMap<>();
        view.put("id", event.id().toString());
        view.put("title", event.title());
        view.put("category", event.category());
        view.put("venue", event.venueName());
        view.put("starts", ToolArgs.localTime(event.startsAt()));
        if (event.endsAt() != null) {
            view.put("ends", ToolArgs.localTime(event.endsAt()));
        }
        if (event.priceMin() != null || event.priceMax() != null) {
            view.put("price_lei", event.priceMin() == null || event.priceMin().equals(event.priceMax())
                    ? String.valueOf(event.priceMax() == null ? event.priceMin() : event.priceMax())
                    : event.priceMin() + "-" + (event.priceMax() == null ? "?" : event.priceMax()));
        } else {
            view.put("price_lei", "USER".equals(event.source()) ? "free / not set" : "unknown");
        }
        view.put("source", "USER".equals(event.source())
                ? "created in our app (users can join here)" : "imported; tickets on the organiser's site");
        if (event.capacity() != null) {
            view.put("spots_left", event.spotsLeft());
        }
        if (event.lat() != null && event.lon() != null) {
            int meters = (int) Math.round(distance(event, context));
            view.put("distance_meters", meters);
            view.put("walk_minutes", ToolArgs.walkMinutes(meters));
        } else {
            view.put("distance_meters", "unknown (no map location)");
        }
        return view;
    }

    // Meters from the user to an event that has coordinates.
    private static double distance(EventSummary event, ToolContext context) {
        return context.origin().distanceMetersTo(new GeoPoint(event.lat(), event.lon()));
    }
}
