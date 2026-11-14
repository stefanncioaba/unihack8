package com.unihack8.backend.neighbourhoods.service.impl;

import com.unihack8.backend.common.dto.PageParams;
import com.unihack8.backend.common.geo.BoundingBox;
import com.unihack8.backend.events.domain.dto.EventSummary;
import com.unihack8.backend.events.domain.dto.ParticipantResponse;
import com.unihack8.backend.events.service.EventService;
import com.unihack8.backend.neighbourhoods.domain.dto.NeighbourhoodPulseDto;
import com.unihack8.backend.neighbourhoods.domain.dto.NeighbourhoodPulseResponse;
import com.unihack8.backend.neighbourhoods.domain.dto.PulseEventDto;
import com.unihack8.backend.neighbourhoods.domain.dto.PulseEventsDto;
import com.unihack8.backend.neighbourhoods.domain.dto.PulsePeopleDto;
import com.unihack8.backend.neighbourhoods.domain.dto.PulsePlacesDto;
import com.unihack8.backend.neighbourhoods.domain.dto.PulseTransitDto;
import com.unihack8.backend.neighbourhoods.domain.model.Neighbourhood;
import com.unihack8.backend.neighbourhoods.domain.model.NeighbourhoodAreas;
import com.unihack8.backend.neighbourhoods.mapper.NeighbourhoodPulseMapper;
import com.unihack8.backend.neighbourhoods.service.NeighbourhoodPulseService;
import com.unihack8.backend.places.domain.OpeningHours;
import com.unihack8.backend.places.domain.dto.PlaceExploreCriteria;
import com.unihack8.backend.places.domain.dto.PlaceInsightDto;
import com.unihack8.backend.places.service.PlaceService;
import com.unihack8.backend.transit.domain.dto.AlertDto;
import com.unihack8.backend.transit.domain.dto.TransitRouteDto;
import com.unihack8.backend.transit.domain.dto.TransitStopDto;
import com.unihack8.backend.transit.domain.dto.VehicleDto;
import com.unihack8.backend.transit.service.TransitService;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

/**
 * Builds the Neighbourhood Pulse from the existing services. Every source is read once for the
 * whole city and each item is put in its area with {@link NeighbourhoodAreas#assign}. The answer
 * is cached for {@link #CACHE_TTL}, so many phones opening the screen cost one round of calls.
 */
@Service
public class NeighbourhoodPulseServiceImpl implements NeighbourhoodPulseService {

    private static final Logger log = LoggerFactory.getLogger(NeighbourhoodPulseServiceImpl.class);

    static final ZoneId CITY_ZONE = ZoneId.of("Europe/Bucharest");
    static final Duration CACHE_TTL = Duration.ofSeconds(30);
    // An event without an end time counts as running for this long after its start.
    static final Duration DEFAULT_EVENT_LENGTH = Duration.ofHours(3);
    // "Tonight" ends at this local time on the next morning.
    static final LocalTime NIGHT_ENDS = LocalTime.of(5, 0);
    // Events started up to this long ago may still be running.
    static final Duration LOOK_BACK = Duration.ofHours(12);
    // Starting reliability score; people at or above it count as reliable.
    static final int RELIABLE_SCORE = 100;
    static final int MAX_HIGHLIGHTS = 3;
    static final int BUSY_SCORE = 15;
    static final int STEADY_SCORE = 5;
    private static final int MAX_PLACES_PER_AREA = 5000;

    private final EventService events;
    private final PlaceService places;
    private final TransitService transit;
    private final NeighbourhoodPulseMapper mapper;
    private final Clock clock;
    private final List<Neighbourhood> areas;

    private volatile NeighbourhoodPulseResponse cached;

    // Uses the hard-coded Timișoara areas.
    @Autowired
    public NeighbourhoodPulseServiceImpl(EventService events, PlaceService places, TransitService transit,
                                         NeighbourhoodPulseMapper mapper, Clock clock) {
        this(events, places, transit, mapper, clock, NeighbourhoodAreas.ALL);
    }

    // Any list of areas (tests use small ones).
    NeighbourhoodPulseServiceImpl(EventService events, PlaceService places, TransitService transit,
                                  NeighbourhoodPulseMapper mapper, Clock clock, List<Neighbourhood> areas) {
        this.events = events;
        this.places = places;
        this.transit = transit;
        this.mapper = mapper;
        this.clock = clock;
        this.areas = List.copyOf(areas);
    }

    // Serves the cached answer while it is fresh, otherwise builds a new one.
    @Override
    public NeighbourhoodPulseResponse pulse() {
        Instant now = clock.instant();
        NeighbourhoodPulseResponse last = cached;
        if (last != null && last.generatedAt().plus(CACHE_TTL).isAfter(now)) {
            return last;
        }
        NeighbourhoodPulseResponse fresh = build(now);
        cached = fresh;
        return fresh;
    }

    // Reads every source once, splits the results by area and scores each area.
    private NeighbourhoodPulseResponse build(Instant now) {
        Map<String, AreaEvents> eventsByArea = eventsByArea(now);
        Map<String, PulseTransitDto> transitByArea = transitByArea();
        LocalDateTime localNow = LocalDateTime.ofInstant(now, CITY_ZONE);

        List<NeighbourhoodPulseDto> cards = new ArrayList<>();
        for (Neighbourhood area : areas) {
            AreaEvents areaEvents = eventsByArea.getOrDefault(area.id(), new AreaEvents());
            PulseEventsDto eventsDto = areaEvents.toDto(mapper);
            PulsePeopleDto people = people(areaEvents);
            PulsePlacesDto placesDto = places(area, localNow);
            PulseTransitDto transitDto = transitByArea.getOrDefault(area.id(), PulseTransitDto.unavailable());
            int score = score(eventsDto, people, placesDto, transitDto);
            cards.add(mapper.toPulse(area, level(score), score, eventsDto, transitDto, placesDto, people));
        }
        cards.sort(Comparator.comparingInt(NeighbourhoodPulseDto::score).reversed()
                .thenComparing(NeighbourhoodPulseDto::name));
        return new NeighbourhoodPulseResponse(now, List.copyOf(cards));
    }

    // Activity score: events weigh most, then people going, then open places and vehicles (both capped).
    static int score(PulseEventsDto events, PulsePeopleDto people, PulsePlacesDto places, PulseTransitDto transit) {
        return events.nowCount() * 4 + events.tonightCount() * 2 + people.going()
                + Math.min(places.openNow() / 5, 8) + Math.min(transit.liveVehicles(), 5);
    }

    // QUIET below STEADY_SCORE, BUSY from BUSY_SCORE, STEADY in between.
    static String level(int score) {
        if (score >= BUSY_SCORE) {
            return "BUSY";
        }
        return score >= STEADY_SCORE ? "STEADY" : "QUIET";
    }

    // End of "tonight": 05:00 local time on the next morning (or this morning, before 05:00).
    static Instant tonightEnds(Instant now) {
        ZonedDateTime local = now.atZone(CITY_ZONE);
        ZonedDateTime end = local.toLocalDate().atTime(NIGHT_ENDS).atZone(CITY_ZONE);
        if (!end.isAfter(local)) {
            end = end.plusDays(1);
        }
        return end.toInstant();
    }

    // True when the event has started and has not ended (no end time = DEFAULT_EVENT_LENGTH).
    static boolean happeningNow(EventSummary event, Instant now) {
        Instant end = event.endsAt() != null ? event.endsAt() : event.startsAt().plus(DEFAULT_EVENT_LENGTH);
        return !event.startsAt().isAfter(now) && end.isAfter(now);
    }

    // Events running now or starting before the night ends, grouped by area; empty when the database fails.
    private Map<String, AreaEvents> eventsByArea(Instant now) {
        Map<String, AreaEvents> result = new HashMap<>();
        List<EventSummary> found;
        try {
            found = events.search(null, null, now.minus(LOOK_BACK), tonightEnds(now), cityBox(),
                    null, 0, PageParams.MAX_MAP_SIZE).items();
        } catch (RuntimeException e) {
            log.warn("Neighbourhood pulse: events unavailable: {}", e.getMessage());
            return result;
        }
        for (EventSummary event : found) {
            if (event.lat() == null || event.lon() == null) {
                continue;
            }
            boolean running = happeningNow(event, now);
            if (!running && !event.startsAt().isAfter(now)) {
                continue; // already over
            }
            NeighbourhoodAreas.assign(event.lat(), event.lon(), areas).ifPresent(area ->
                    result.computeIfAbsent(area.id(), id -> new AreaEvents()).add(event, running));
        }
        return result;
    }

    // Distinct people joined or checked in to the area's events, and how many of them are reliable.
    private PulsePeopleDto people(AreaEvents areaEvents) {
        Map<UUID, Integer> scores = new HashMap<>();
        for (EventSummary event : areaEvents.all()) {
            if (!"USER".equals(event.source())) {
                continue; // imported events have no participants in the app
            }
            try {
                for (ParticipantResponse participant : events.participants(event.id())) {
                    if ("JOINED".equals(participant.status()) || "ATTENDED".equals(participant.status())) {
                        scores.put(participant.user().id(), participant.user().reliabilityScore());
                    }
                }
            } catch (RuntimeException e) {
                log.warn("Neighbourhood pulse: participants of {} unavailable: {}", event.id(), e.getMessage());
            }
        }
        int reliable = (int) scores.values().stream().filter(score -> score >= RELIABLE_SCORE).count();
        return new PulsePeopleDto(scores.size(), reliable);
    }

    // Places in the area (nearer areas keep shared ones) and how many are open now.
    private PulsePlacesDto places(Neighbourhood area, LocalDateTime localNow) {
        List<PlaceInsightDto> found;
        try {
            found = places.explore(new PlaceExploreCriteria(Set.of(), null, area.centre(), area.radiusMeters(),
                    null, false, false, MAX_PLACES_PER_AREA));
        } catch (RuntimeException e) {
            log.warn("Neighbourhood pulse: places unavailable: {}", e.getMessage());
            return new PulsePlacesDto(0, 0, List.of());
        }
        int total = 0;
        Map<String, Integer> openByCategory = new HashMap<>();
        for (PlaceInsightDto insight : found) {
            var place = insight.place();
            boolean mine = NeighbourhoodAreas.assign(place.lat(), place.lon(), areas)
                    .map(a -> a.id().equals(area.id())).orElse(false);
            if (!mine) {
                continue;
            }
            total++;
            if (Boolean.TRUE.equals(OpeningHours.at(place.openingHours(), localNow).open())) {
                openByCategory.merge(place.category(), 1, Integer::sum);
            }
        }
        int open = openByCategory.values().stream().mapToInt(Integer::intValue).sum();
        List<String> top = openByCategory.entrySet().stream()
                .sorted(Map.Entry.<String, Integer>comparingByValue().reversed().thenComparing(Map.Entry.comparingByKey()))
                .limit(3).map(Map.Entry::getKey).toList();
        return new PulsePlacesDto(total, open, top);
    }

    // Lines, stops, live vehicles and alerts per area; every area unavailable when STPT's stop list fails.
    private Map<String, PulseTransitDto> transitByArea() {
        List<TransitStopDto> stops;
        try {
            stops = transit.stops(null);
        } catch (RuntimeException e) {
            log.warn("Neighbourhood pulse: transit stops unavailable: {}", e.getMessage());
            return Map.of();
        }
        Map<String, String> lineNames = safe(() -> transit.routes().stream()
                .collect(Collectors.toMap(TransitRouteDto::id, TransitRouteDto::name, (a, b) -> a)), Map.of(), "routes");
        List<VehicleDto> vehicles = safe(() -> transit.vehicles(null).vehicles(), List.of(), "vehicles");
        List<AlertDto> alerts = safe(transit::alerts, List.of(), "alerts");

        Map<String, Set<String>> lines = new HashMap<>();
        Map<String, List<String>> stopNames = new HashMap<>();
        for (TransitStopDto stop : stops) {
            NeighbourhoodAreas.assign(stop.lat(), stop.lon(), areas).ifPresent(area -> {
                stopNames.computeIfAbsent(area.id(), id -> new ArrayList<>()).add(stop.name());
                Set<String> areaLines = lines.computeIfAbsent(area.id(), id -> new TreeSet<>(AREA_LINE_ORDER));
                for (String route : stop.routes() == null ? List.<String>of() : stop.routes()) {
                    areaLines.add(lineNames.getOrDefault(route, route));
                }
            });
        }
        Map<String, Integer> vehicleCounts = new HashMap<>();
        for (VehicleDto vehicle : vehicles) {
            NeighbourhoodAreas.assign(vehicle.lat(), vehicle.lon(), areas)
                    .ifPresent(area -> vehicleCounts.merge(area.id(), 1, Integer::sum));
        }
        Map<String, PulseTransitDto> result = new LinkedHashMap<>();
        for (Neighbourhood area : areas) {
            Set<String> areaLines = lines.getOrDefault(area.id(), Set.of());
            List<String> names = stopNames.getOrDefault(area.id(), List.of());
            List<AlertDto> areaAlerts = alerts.stream()
                    .filter(alert -> AlertMatcher.concerns(alert, areaLines, names)).toList();
            result.put(area.id(), new PulseTransitDto(true, List.copyOf(areaLines), names.size(),
                    vehicleCounts.getOrDefault(area.id(), 0), areaAlerts));
        }
        return result;
    }

    // Line names with numbers in numeric order ("2" before "11"), then the rest alphabetically.
    static final Comparator<String> AREA_LINE_ORDER = Comparator
            .comparing((String name) -> !name.matches("\\d+"))
            .thenComparingInt(name -> name.matches("\\d+") ? Integer.parseInt(name) : 0)
            .thenComparing(Function.identity());

    // Runs one optional transit call; a failure gives the fallback and a log line.
    private static <T> T safe(java.util.function.Supplier<T> call, T fallback, String what) {
        try {
            return call.get();
        } catch (RuntimeException e) {
            log.warn("Neighbourhood pulse: transit {} unavailable: {}", what, e.getMessage());
            return fallback;
        }
    }

    // The smallest box around every area, in the API's bbox text format.
    private String cityBox() {
        double minLon = 180, minLat = 90, maxLon = -180, maxLat = -90;
        for (Neighbourhood area : areas) {
            BoundingBox box = area.centre().boxAround(area.radiusMeters());
            minLon = Math.min(minLon, box.minLon());
            minLat = Math.min(minLat, box.minLat());
            maxLon = Math.max(maxLon, box.maxLon());
            maxLat = Math.max(maxLat, box.maxLat());
        }
        return String.format(Locale.ROOT, "%.5f,%.5f,%.5f,%.5f", minLon, minLat, maxLon, maxLat);
    }

    /** The events of one area while the answer is being built. */
    private static final class AreaEvents {
        private final List<EventSummary> now = new ArrayList<>();
        private final List<EventSummary> later = new ArrayList<>();

        // Files the event under "now" or "later tonight".
        void add(EventSummary event, boolean running) {
            (running ? now : later).add(event);
        }

        // Every event of the area, the running ones first.
        List<EventSummary> all() {
            List<EventSummary> all = new ArrayList<>(now);
            all.addAll(later);
            return all;
        }

        // Counts, free spots and the first few events (running first, then by start time).
        PulseEventsDto toDto(NeighbourhoodPulseMapper mapper) {
            Comparator<EventSummary> byStart = Comparator.comparing(EventSummary::startsAt);
            List<PulseEventDto> highlights = new ArrayList<>();
            now.stream().sorted(byStart).forEach(e -> highlights.add(mapper.toEvent(e, true)));
            later.stream().sorted(byStart).forEach(e -> highlights.add(mapper.toEvent(e, false)));
            Set<UUID> seen = new HashSet<>();
            int freeSpots = all().stream().filter(e -> seen.add(e.id()))
                    .map(EventSummary::spotsLeft).filter(java.util.Objects::nonNull)
                    .mapToInt(Integer::intValue).sum();
            return new PulseEventsDto(now.size(), later.size(), freeSpots,
                    List.copyOf(highlights.subList(0, Math.min(MAX_HIGHLIGHTS, highlights.size()))));
        }
    }
}
