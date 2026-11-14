package com.unihack8.backend.transit.service.impl;

import com.unihack8.backend.common.cache.StaleCache;
import com.unihack8.backend.common.exception.ApiException;
import com.unihack8.backend.common.exception.ErrorCode;
import com.unihack8.backend.common.geo.BoundingBox;
import com.unihack8.backend.common.geo.GeoPoint;
import com.unihack8.backend.transit.client.StptClient;
import com.unihack8.backend.transit.config.StptProperties;
import com.unihack8.backend.transit.domain.dto.AlertDto;
import com.unihack8.backend.transit.domain.dto.ArrivalDto;
import com.unihack8.backend.transit.domain.dto.ArrivalsResponse;
import com.unihack8.backend.transit.domain.dto.LastDepartureDto;
import com.unihack8.backend.transit.domain.dto.LastDeparturesResponse;
import com.unihack8.backend.transit.domain.dto.NearestStopDto;
import com.unihack8.backend.transit.domain.dto.TransitRouteDto;
import com.unihack8.backend.transit.domain.dto.TransitShapeDto;
import com.unihack8.backend.transit.domain.dto.TransitStopDto;
import com.unihack8.backend.transit.domain.dto.TransitSummaryResponse;
import com.unihack8.backend.transit.domain.dto.VehiclesResponse;
import com.unihack8.backend.transit.domain.dto.stpt.StptAlert;
import com.unihack8.backend.transit.domain.dto.stpt.StptArrival;
import com.unihack8.backend.transit.domain.dto.stpt.StptRoute;
import com.unihack8.backend.transit.domain.dto.stpt.StptStop;
import com.unihack8.backend.transit.domain.dto.stpt.StptVehicle;
import com.unihack8.backend.transit.domain.model.ScheduledDeparture;
import com.unihack8.backend.transit.mapper.TransitMapper;
import com.unihack8.backend.transit.repository.ShapeRepository;
import com.unihack8.backend.transit.repository.TimetableRepository;
import com.unihack8.backend.transit.service.TransitService;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import org.springframework.stereotype.Service;

/** Cached STPT data shaped for the app. */
@Service
public class TransitServiceImpl implements TransitService {

    static final String SOURCE_LIVE_ESTIMATE = "LIVE_ESTIMATE";
    static final String SOURCE_TIMETABLE = "TIMETABLE";
    // Trips after midnight belong to the previous service day until this hour.
    private static final int SERVICE_DAY_START_HOUR = 3;
    private static final String ALL = "all";
    private static final ZoneId CITY_ZONE = ZoneId.of("Europe/Bucharest");
    private static final DateTimeFormatter HOUR_MINUTE = DateTimeFormatter.ofPattern("HH:mm");
    // Order of line types in GET /transit/routes.
    private static final List<String> TYPE_ORDER =
            List.of("TRAM", "TROLLEYBUS", "BUS", "EXPRESS", "METROPOLITAN", "BOAT");
    // After STPT's line list fails (nothing cached), vehicles/shapes do not ask for it again for this long.
    static final Duration ROUTES_RETRY_AFTER = Duration.ofSeconds(60);
    // Shapes built without STPT's line facts (GTFS only) are reused this long before trying again.
    static final Duration FALLBACK_SHAPES_TTL = Duration.ofMinutes(5);

    private final StptClient stpt;
    private final TransitMapper mapper;
    private final TimetableRepository timetable;
    private final ShapeRepository shapeRepository;
    private final Clock clock;
    private final StaleCache<String, List<StptStop>> stopsCache;
    private final StaleCache<String, List<StptRoute>> routesCache;
    private final StaleCache<String, List<StptAlert>> alertsCache;
    private final StaleCache<String, List<StptVehicle>> vehiclesCache;
    // Every line's vehicles in one STPT call, shared by all map clients for the vehicles TTL.
    private final StaleCache<String, List<StptVehicle>> allVehiclesCache;
    private final StaleCache<String, List<StptArrival>> arrivalsCache;
    // Built line shapes; kept once STPT's line list was available to give them types and colours.
    private volatile List<TransitShapeDto> shapesCache;
    // GTFS-only shapes built while STPT's line list was unavailable, and when they were built.
    private volatile List<TransitShapeDto> fallbackShapes;
    private volatile Instant fallbackShapesAt;
    // Until this moment the line list is not fetched again for vehicles/shapes (set after a failed fetch).
    private volatile Instant routesRetryAt;

    // One cache per kind of STPT data, with the lifetimes from StptProperties.
    public TransitServiceImpl(StptClient stpt, TransitMapper mapper, TimetableRepository timetable,
                              ShapeRepository shapeRepository, Clock clock, StptProperties props) {
        this.stpt = stpt;
        this.mapper = mapper;
        this.timetable = timetable;
        this.shapeRepository = shapeRepository;
        this.clock = clock;
        StptProperties.Ttl ttl = props.ttl();
        this.stopsCache = new StaleCache<>("STPT stops", ttl.staticData(), clock);
        this.routesCache = new StaleCache<>("STPT routes", ttl.staticData(), clock);
        this.alertsCache = new StaleCache<>("STPT alerts", ttl.alerts(), clock);
        this.vehiclesCache = new StaleCache<>("STPT vehicles", ttl.vehicles(), clock);
        this.allVehiclesCache = new StaleCache<>("STPT all vehicles", ttl.vehicles(), clock);
        this.arrivalsCache = new StaleCache<>("STPT arrivals", ttl.arrivals(), clock);
    }

    // Lines sorted by type, then by name with numbers in numeric order (2 before 11); lines without a name dropped.
    @Override
    public List<TransitRouteDto> routes() {
        return routesCache.get(ALL, k -> stpt.fetchRoutes()).value().stream()
                .map(mapper::toRoute)
                .filter(r -> r.id() != null && !r.id().isBlank())
                .sorted(Comparator.comparingInt((TransitRouteDto r) -> typeRank(r.type()))
                        .thenComparing(TransitRouteDto::name, TransitServiceImpl::compareLineNames))
                .toList();
    }

    // All stops, optionally only those inside the bbox.
    @Override
    public List<TransitStopDto> stops(BoundingBox bbox) {
        return allStops().stream()
                .filter(s -> bbox == null || bbox.contains(s.lat(), s.lon()))
                .map(mapper::toStop)
                .toList();
    }

    // Live positions of one line's vehicles, or of every line's when route is null/blank.
    @Override
    public VehiclesResponse vehicles(String route) {
        boolean all = route == null || route.isBlank();
        String line = all ? null : route.trim();
        StaleCache.Result<List<StptVehicle>> result = all
                ? allVehiclesCache.get(ALL, k -> stpt.fetchAllVehicles())
                : vehiclesCache.get(line, stpt::fetchVehicles);
        Map<String, TransitRouteDto> lines = linesById();
        return new VehiclesResponse(line, result.fetchedAt(), result.stale(), result.value().stream()
                .map(v -> mapper.toVehicle(v, v.route() == null ? null : lines.get(lineKey(v.route()))))
                .toList());
    }

    // Every line's path (sorted like GET /transit/routes), or only the asked line's.
    @Override
    public List<TransitShapeDto> shapes(String route) {
        List<TransitShapeDto> all = allShapes();
        if (route == null || route.isBlank()) {
            return all;
        }
        String wanted = route.trim();
        return all.stream().filter(s -> s.route().equalsIgnoreCase(wanted)).toList();
    }

    // Builds the shapes once; while STPT's line list is unavailable a GTFS-only build is reused for a few minutes.
    private List<TransitShapeDto> allShapes() {
        List<TransitShapeDto> cached = shapesCache;
        if (cached != null) {
            return cached;
        }
        Instant now = clock.instant();
        List<TransitShapeDto> fallback = fallbackShapes;
        Instant fallbackAt = fallbackShapesAt;
        if (fallback != null && fallbackAt != null && fallbackAt.plus(FALLBACK_SHAPES_TTL).isAfter(now)) {
            return fallback;
        }
        Map<String, TransitRouteDto> lines = linesById();
        List<TransitShapeDto> built = shapeRepository.shapes().stream()
                .map(s -> mapper.toShape(s, s.routeName() == null ? null : lines.get(lineKey(s.routeName()))))
                .sorted(Comparator.comparingInt((TransitShapeDto s) -> typeRank(s.type()))
                        .thenComparing(TransitShapeDto::routeName, TransitServiceImpl::compareLineNames))
                .toList();
        if (!built.isEmpty()) {
            if (!lines.isEmpty()) {
                shapesCache = built;
                fallbackShapes = null;
            } else {
                fallbackShapes = built;
                fallbackShapesAt = now;
            }
        }
        return built;
    }

    // STPT lines by lower-case id; empty when STPT's line list cannot be loaded (then not retried for a minute).
    private Map<String, TransitRouteDto> linesById() {
        Instant retryAt = routesRetryAt;
        if (retryAt != null && clock.instant().isBefore(retryAt)) {
            return Map.of();
        }
        try {
            Map<String, TransitRouteDto> byId = new HashMap<>();
            for (TransitRouteDto r : routes()) {
                if (r.id() != null && !r.id().isBlank()) {
                    byId.putIfAbsent(lineKey(r.id()), r);
                }
            }
            return byId;
        } catch (RuntimeException e) {
            routesRetryAt = clock.instant().plus(ROUTES_RETRY_AFTER);
            return Map.of();
        }
    }

    // Case-insensitive line key ("5B" and "5b" are the same line); callers pass a non-null id.
    private static String lineKey(String id) {
        return id.trim().toLowerCase(Locale.ROOT);
    }

    // Next arrivals at a stop, soonest first.
    @Override
    public ArrivalsResponse arrivals(String stopId) {
        String id = requireText(stopId, "stopId");
        String stopName = stopName(id);
        StaleCache.Result<List<StptArrival>> result = arrivalsCache.get(id, stpt::fetchArrivals);
        Instant now = clock.instant();
        List<ArrivalDto> arrivals = result.value().stream()
                .flatMap(a -> mapper.toArrivals(a, now).stream())
                .sorted(Comparator.comparing(ArrivalDto::arrivesAt))
                .toList();
        return new ArrivalsResponse(id, stopName, result.fetchedAt(), result.stale(), arrivals);
    }

    // Current service alerts.
    @Override
    public List<AlertDto> alerts() {
        return alertsCache.get(ALL, k -> stpt.fetchAlerts()).value().stream().map(mapper::toAlert).toList();
    }

    // From the GTFS timetable when it covers today; otherwise the latest arrival STPT reports live.
    @Override
    public LastDeparturesResponse lastDepartures(String stopId) {
        String id = requireText(stopId, "stopId");
        LocalDate serviceDate = serviceDate(clock.instant());
        Optional<List<ScheduledDeparture>> scheduled = timetable.lastDepartures(id, serviceDate);
        if (scheduled.isPresent() && !scheduled.get().isEmpty()) {
            List<LastDepartureDto> departures = scheduled.get().stream()
                    .map(d -> new LastDepartureDto(d.route(), d.headsign(),
                            serviceDate.atStartOfDay(CITY_ZONE).plusSeconds(d.departureSeconds()).toInstant()))
                    .sorted(Comparator.comparing(LastDepartureDto::route, TransitServiceImpl::compareLineNames)
                            .thenComparing(d -> String.valueOf(d.headsign())))
                    .toList();
            return new LastDeparturesResponse(id, timetableStopName(id), SOURCE_TIMETABLE, departures);
        }
        return liveLastDepartures(id);
    }

    // Fallback (no timetable file, or it does not cover today): latest arrival seen live per line/direction.
    private LastDeparturesResponse liveLastDepartures(String stopId) {
        ArrivalsResponse arrivals = arrivals(stopId);
        Map<String, LastDepartureDto> latest = new LinkedHashMap<>();
        for (ArrivalDto a : arrivals.arrivals()) {
            String key = a.route() + "\u0000" + a.headsign();
            LastDepartureDto known = latest.get(key);
            if (known == null || a.arrivesAt().isAfter(known.lastDepartureAt())) {
                latest.put(key, new LastDepartureDto(a.route(), a.headsign(), a.arrivesAt()));
            }
        }
        List<LastDepartureDto> departures = latest.values().stream()
                .sorted(Comparator.comparing(LastDepartureDto::route, TransitServiceImpl::compareLineNames)
                        .thenComparing(d -> String.valueOf(d.headsign())))
                .toList();
        return new LastDeparturesResponse(arrivals.stopId(), arrivals.stopName(), SOURCE_LIVE_ESTIMATE, departures);
    }

    // Nearest stop, its last departures, alert count and a ready-to-show sentence.
    @Override
    public TransitSummaryResponse summary(GeoPoint near, Locale locale) {
        StptStop nearest = allStops().stream()
                .min(Comparator.comparingDouble(s -> distance(near, s)))
                .orElseThrow(() -> ApiException.notFound("Stop"));
        NearestStopDto stop = new NearestStopDto(nearest.stopCode(), nearest.stopName(),
                (int) Math.round(distance(near, nearest)));
        List<LastDepartureDto> departures = lastDepartures(nearest.stopCode()).departures();
        boolean romanian = locale != null && "ro".equals(locale.getLanguage());
        return new TransitSummaryResponse(stop, departures, activeAlertCount(),
                message(stop.name(), departures, romanian));
    }

    // "Last tram 2 from X leaves at 23:41" for the line that stops running first among those still running.
    private String message(String stopName, List<LastDepartureDto> departures, boolean romanian) {
        if (departures.isEmpty()) {
            return romanian
                    ? "Nu există plecări cunoscute din " + stopName + " acum."
                    : "No departures known from " + stopName + " right now.";
        }
        Instant now = clock.instant();
        Optional<LastDepartureDto> first = departures.stream()
                .filter(d -> !d.lastDepartureAt().isBefore(now))
                .min(Comparator.comparing(LastDepartureDto::lastDepartureAt));
        if (first.isEmpty()) {
            return romanian
                    ? "Nu mai sunt plecări din " + stopName + " în seara asta."
                    : "No more departures from " + stopName + " tonight.";
        }
        LastDepartureDto d = first.get();
        String time = HOUR_MINUTE.format(d.lastDepartureAt().atZone(CITY_ZONE));
        String vehicle = vehicleWord(typeOf(d.route()), romanian);
        return romanian
                ? "Ultimul " + vehicle + " " + d.route() + " din " + stopName + " pleacă la " + time
                : "Last " + vehicle + " " + d.route() + " from " + stopName + " leaves at " + time;
    }

    // Line type (TRAM, BUS, ...) from the cached route list; null when unknown or STPT is down.
    private String typeOf(String route) {
        try {
            return routes().stream().filter(r -> r.id().equalsIgnoreCase(route))
                    .map(TransitRouteDto::type).findFirst().orElse(null);
        } catch (ApiException e) {
            return null;
        }
    }

    // Vehicle noun used in the summary sentence.
    static String vehicleWord(String type, boolean romanian) {
        if (type == null) {
            return romanian ? "vehicul" : "service";
        }
        return switch (type) {
            case "TRAM" -> romanian ? "tramvai" : "tram";
            case "TROLLEYBUS" -> romanian ? "troleibuz" : "trolleybus";
            case "BOAT" -> romanian ? "vaporetto" : "boat";
            default -> romanian ? "autobuz" : "bus";
        };
    }

    // Number of active alerts; 0 when STPT is down (the summary still shows departures).
    private int activeAlertCount() {
        try {
            return alerts().size();
        } catch (ApiException e) {
            return 0;
        }
    }

    // Service day for a moment: before 03:00 Timișoara time the previous day's late trips still count.
    static LocalDate serviceDate(Instant now) {
        ZonedDateTime local = now.atZone(CITY_ZONE);
        return local.getHour() < SERVICE_DAY_START_HOUR ? local.toLocalDate().minusDays(1) : local.toLocalDate();
    }

    // Stop name from STPT's live list, else from the timetable; 404 when neither knows the stop.
    private String timetableStopName(String stopId) {
        try {
            String name = stopName(stopId);
            return name != null ? name : timetable.stopName(stopId).orElse(null);
        } catch (ApiException e) {
            return timetable.stopName(stopId).orElseThrow(() -> e);
        }
    }

    // Meters from a point to a stop.
    private static double distance(GeoPoint from, StptStop stop) {
        return from.distanceMetersTo(new GeoPoint(stop.lat(), stop.lon()));
    }

    // Cached stop list.
    private List<StptStop> allStops() {
        return stopsCache.get(ALL, k -> stpt.fetchStops()).value();
    }

    // Name of a stop; 404 when the stop list is known and lacks it, null when the list is unavailable.
    private String stopName(String stopId) {
        List<StptStop> stops;
        try {
            stops = allStops();
        } catch (ApiException e) {
            return null;
        }
        return stops.stream().filter(s -> s.stopCode().equals(stopId)).map(StptStop::stopName).findFirst()
                .orElseThrow(() -> ApiException.notFound("Stop"));
    }

    // Trims a required parameter, 400 when blank.
    private static String requireText(String value, String name) {
        if (value == null || value.isBlank()) {
            throw new ApiException(ErrorCode.VALIDATION_FAILED, name + " is required.");
        }
        return value.trim();
    }

    // Position of a type in TYPE_ORDER (unknown types last).
    private static int typeRank(String type) {
        int i = TYPE_ORDER.indexOf(type);
        return i < 0 ? TYPE_ORDER.size() : i;
    }

    // Compares line names like "2", "11", "M14", "E4b": prefix letters, then number, then the rest.
    static int compareLineNames(String a, String b) {
        String pa = a.replaceAll("[0-9].*$", "");
        String pb = b.replaceAll("[0-9].*$", "");
        int byPrefix = pa.compareToIgnoreCase(pb);
        if (byPrefix != 0) {
            return byPrefix;
        }
        int na = leadingNumber(a.substring(pa.length()));
        int nb = leadingNumber(b.substring(pb.length()));
        if (na != nb) {
            return Integer.compare(na, nb);
        }
        return a.compareToIgnoreCase(b);
    }

    // Digits at the start of text as a number, or MAX_VALUE when there are none.
    private static int leadingNumber(String text) {
        int end = 0;
        while (end < text.length() && Character.isDigit(text.charAt(end))) {
            end++;
        }
        return end == 0 ? Integer.MAX_VALUE : Integer.parseInt(text.substring(0, Math.min(end, 9)));
    }
}
