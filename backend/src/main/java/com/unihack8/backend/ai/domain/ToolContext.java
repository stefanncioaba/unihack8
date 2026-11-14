package com.unihack8.backend.ai.domain;

import com.unihack8.backend.common.geo.GeoPoint;
import com.unihack8.backend.events.domain.dto.EventSummary;
import com.unihack8.backend.places.domain.dto.PlaceSummaryDto;
import com.unihack8.backend.places.domain.dto.PriceDto;
import java.time.Instant;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * What the tools of one chat request share: where the user is, what time it is, and every place
 * and event the tools returned (so the answer can list the ones the model mentions, PLAN 11.5).
 * Tools may run in parallel, so the collectors are synchronized.
 */
public class ToolContext {

    /** Piața Victoriei, used when the app sends no location. */
    public static final GeoPoint CITY_CENTRE = new GeoPoint(45.7537, 21.2257);

    /** All times shown to the model are Romanian local time. */
    public static final ZoneId ZONE = ZoneId.of("Europe/Bucharest");

    /** A start point this close to the user still counts as "from the user" (PLAN 18.3). */
    public static final double USER_START_RADIUS_METERS = 50;

    private final GeoPoint origin;
    private final boolean locationKnown;
    private final Instant now;
    private final Map<UUID, FoundPlace> places = new LinkedHashMap<>();
    private final Map<UUID, EventSummary> events = new LinkedHashMap<>();
    private final List<PlannedRoute> routes = new ArrayList<>();

    // Context for one request; origin null means the location is unknown (city centre is used).
    public ToolContext(GeoPoint origin, Instant now) {
        this.locationKnown = origin != null;
        this.origin = origin == null ? CITY_CENTRE : origin;
        this.now = now;
    }

    // Where distances are measured from: the user, or the city centre.
    public GeoPoint origin() {
        return origin;
    }

    // True when the app sent the user position.
    public boolean locationKnown() {
        return locationKnown;
    }

    // Request time.
    public Instant now() {
        return now;
    }

    // Remembers a place a tool returned, with the prices shown for it. A place returned again (e.g. a COFFEE
    // search, then a PIZZA one) keeps every distinct price the model saw for it, in the order seen.
    public synchronized void rememberPlace(PlaceSummaryDto place, List<PriceDto> prices) {
        FoundPlace known = places.get(place.id());
        if (known == null) {
            places.put(place.id(), new FoundPlace(place, List.copyOf(prices)));
            return;
        }
        LinkedHashSet<PriceDto> merged = new LinkedHashSet<>(known.prices());
        merged.addAll(prices);
        places.put(place.id(), new FoundPlace(known.place(), List.copyOf(merged)));
    }

    // Remembers an event a tool returned.
    public synchronized void rememberEvent(EventSummary event) {
        events.putIfAbsent(event.id(), event);
    }

    /**
     * True only when the app sent the user's real position and the route starts there: no start
     * given, or one within USER_START_RADIUS_METERS of the user (PLAN 18.3). The city-centre
     * default is never the user's position.
     */
    public boolean startsFromUser(GeoPoint start) {
        if (!locationKnown) {
            return false;
        }
        return start == null || start.distanceMetersTo(origin) <= USER_START_RADIUS_METERS;
    }

    // Remembers a route plan_route planned (PLAN 18.2).
    public synchronized void rememberRoute(PlannedRoute route) {
        routes.add(route);
    }

    // Every route planned so far, in the order planned.
    public synchronized List<PlannedRoute> routes() {
        return new ArrayList<>(routes);
    }

    // Every place returned so far, in the order found.
    public synchronized List<FoundPlace> places() {
        return new ArrayList<>(places.values());
    }

    // Every event returned so far, in the order found.
    public synchronized List<EventSummary> events() {
        return new ArrayList<>(events.values());
    }

    /** A route plan_route planned: its ends, the mode it really uses, and whether it starts at the user. */
    public record PlannedRoute(GeoPoint from, GeoPoint to, String mode, long durationMinutes, long distanceMeters,
                               boolean startsFromUser) {
    }

    /** A place returned by a tool and the prices the model saw for it. */
    public record FoundPlace(PlaceSummaryDto place, List<PriceDto> prices) {
    }
}
