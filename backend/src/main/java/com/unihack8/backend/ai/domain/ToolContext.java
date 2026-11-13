package com.unihack8.backend.ai.domain;

import com.unihack8.backend.common.geo.GeoPoint;
import com.unihack8.backend.events.domain.dto.EventSummary;
import com.unihack8.backend.places.domain.dto.PlaceSummaryDto;
import com.unihack8.backend.places.domain.dto.PriceDto;
import java.time.Instant;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.LinkedHashMap;
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

    private final GeoPoint origin;
    private final boolean locationKnown;
    private final Instant now;
    private final Map<UUID, FoundPlace> places = new LinkedHashMap<>();
    private final Map<UUID, EventSummary> events = new LinkedHashMap<>();

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

    // Remembers a place a tool returned, with the prices shown for it.
    public synchronized void rememberPlace(PlaceSummaryDto place, List<PriceDto> prices) {
        places.putIfAbsent(place.id(), new FoundPlace(place, List.copyOf(prices)));
    }

    // Remembers an event a tool returned.
    public synchronized void rememberEvent(EventSummary event) {
        events.putIfAbsent(event.id(), event);
    }

    // Every place returned so far, in the order found.
    public synchronized List<FoundPlace> places() {
        return new ArrayList<>(places.values());
    }

    // Every event returned so far, in the order found.
    public synchronized List<EventSummary> events() {
        return new ArrayList<>(events.values());
    }

    /** A place returned by a tool and the prices the model saw for it. */
    public record FoundPlace(PlaceSummaryDto place, List<PriceDto> prices) {
    }
}
