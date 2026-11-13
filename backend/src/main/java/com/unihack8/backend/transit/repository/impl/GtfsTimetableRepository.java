package com.unihack8.backend.transit.repository.impl;

import com.unihack8.backend.transit.config.StptProperties;
import com.unihack8.backend.transit.domain.model.ScheduledDeparture;
import com.unihack8.backend.transit.repository.TimetableRepository;
import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.zip.ZipEntry;
import java.util.zip.ZipFile;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Repository;

/**
 * Reads the STPT GTFS zip (infra/otp/stpt-gtfs.zip, downloaded by infra/otp/get-data.sh) and keeps,
 * per stop, the latest departure of each line and direction for each service (weekday, Saturday,
 * Sunday...). A trip's final stop is skipped: arriving at the terminus is not a departure.
 */
@Repository
public class GtfsTimetableRepository implements TimetableRepository {

    private static final Logger log = LoggerFactory.getLogger(GtfsTimetableRepository.class);
    private static final DateTimeFormatter GTFS_DATE = DateTimeFormatter.BASIC_ISO_DATE;
    // Where the file usually is when the backend runs from backend/ (default) or from the repo root.
    private static final Path REPO_ROOT_FALLBACK = Path.of("infra", "otp", "stpt-gtfs.zip");

    private final Path zipPath;
    private volatile Timetable timetable;
    private volatile boolean loadAttempted;

    /** One line and direction. */
    private record Line(String route, String headsign) {
    }

    /** Weekly pattern and date range from calendar.txt. */
    private record ServicePattern(boolean[] days, LocalDate start, LocalDate end) {
    }

    /** Everything kept from the file. */
    private record Timetable(Map<String, String> stopNames,
                             Map<String, Map<Line, Map<String, Integer>>> lastByStop,
                             Map<String, ServicePattern> patterns,
                             Map<String, Map<LocalDate, Boolean>> exceptions,
                             LocalDate firstDate, LocalDate lastDate) {
    }

    // Spring: path from stpt.gtfs-path, falling back to infra/otp/stpt-gtfs.zip from the repo root.
    @Autowired
    public GtfsTimetableRepository(StptProperties props) {
        this(resolve(Path.of(props.gtfsPath())));
    }

    // Tests: an explicit file.
    public GtfsTimetableRepository(Path zipPath) {
        this.zipPath = zipPath;
    }

    // Uses the configured path if it exists, otherwise the repo-root location.
    static Path resolve(Path configured) {
        if (Files.exists(configured) || !Files.exists(REPO_ROOT_FALLBACK)) {
            return configured;
        }
        return REPO_ROOT_FALLBACK;
    }

    // Latest departures per line/direction, only for services running on that day.
    @Override
    public Optional<List<ScheduledDeparture>> lastDepartures(String stopId, LocalDate serviceDate) {
        Timetable t = load();
        if (t == null || serviceDate.isBefore(t.firstDate()) || serviceDate.isAfter(t.lastDate())) {
            return Optional.empty();
        }
        List<ScheduledDeparture> result = new ArrayList<>();
        Map<Line, Map<String, Integer>> lines = t.lastByStop().getOrDefault(stopId, Map.of());
        for (Map.Entry<Line, Map<String, Integer>> line : lines.entrySet()) {
            int latest = -1;
            for (Map.Entry<String, Integer> service : line.getValue().entrySet()) {
                if (runs(t, service.getKey(), serviceDate)) {
                    latest = Math.max(latest, service.getValue());
                }
            }
            if (latest >= 0) {
                result.add(new ScheduledDeparture(line.getKey().route(), line.getKey().headsign(), latest));
            }
        }
        result.sort(Comparator.comparing(ScheduledDeparture::route).thenComparing(ScheduledDeparture::headsign));
        return Optional.of(result);
    }

    // Stop name as written in the timetable.
    @Override
    public Optional<String> stopName(String stopId) {
        Timetable t = load();
        return t == null ? Optional.empty() : Optional.ofNullable(t.stopNames().get(stopId));
    }

    // calendar_dates.txt exceptions win over the weekly pattern in calendar.txt.
    private static boolean runs(Timetable t, String serviceId, LocalDate date) {
        Boolean exception = t.exceptions().getOrDefault(serviceId, Map.of()).get(date);
        if (exception != null) {
            return exception;
        }
        ServicePattern p = t.patterns().get(serviceId);
        return p != null && !date.isBefore(p.start()) && !date.isAfter(p.end())
                && p.days()[date.getDayOfWeek().getValue() - 1];
    }

    // Loads the file once; a missing or broken file is logged once and answers "no timetable".
    private Timetable load() {
        if (loadAttempted) {
            return timetable;
        }
        synchronized (this) {
            if (!loadAttempted) {
                try {
                    if (!Files.exists(zipPath)) {
                        log.warn("GTFS timetable not found at {} (run infra/otp/get-data.sh); "
                                + "last departures use live estimates", zipPath.toAbsolutePath());
                    } else {
                        timetable = parse(zipPath);
                    }
                } catch (IOException | RuntimeException e) {
                    log.warn("Could not read GTFS timetable {}: {}", zipPath, e.toString());
                } finally {
                    loadAttempted = true;
                }
            }
            return timetable;
        }
    }

    // Reads stops, routes, trips, stop_times, calendar and calendar_dates.
    private static Timetable parse(Path path) throws IOException {
        long started = System.currentTimeMillis();
        try (ZipFile zip = new ZipFile(path.toFile(), StandardCharsets.UTF_8)) {
            Map<String, String> stopNames = new HashMap<>();
            each(zip, "stops.txt", r -> stopNames.put(r.get("stop_id"), r.get("stop_name")));

            Map<String, String> routeNames = new HashMap<>();
            each(zip, "routes.txt", r -> {
                String shortName = r.getOrDefault("route_short_name", "");
                routeNames.put(r.get("route_id"), shortName.isBlank() ? r.get("route_long_name") : shortName);
            });

            Map<String, Line> tripLine = new HashMap<>();
            Map<String, String> tripService = new HashMap<>();
            each(zip, "trips.txt", r -> {
                String route = routeNames.getOrDefault(r.get("route_id"), r.get("route_id"));
                tripLine.put(r.get("trip_id"), new Line(route, r.getOrDefault("trip_headsign", "")));
                tripService.put(r.get("trip_id"), r.get("service_id"));
            });

            // First pass over stop_times: last stop_sequence of each trip (its terminus).
            Map<String, Integer> lastSequence = new HashMap<>();
            each(zip, "stop_times.txt", r -> lastSequence.merge(r.get("trip_id"),
                    Integer.parseInt(r.get("stop_sequence").trim()), Math::max));

            // Second pass: latest departure per stop, line and service, terminus rows skipped.
            Map<String, Map<Line, Map<String, Integer>>> lastByStop = new HashMap<>();
            each(zip, "stop_times.txt", r -> {
                String trip = r.get("trip_id");
                Line line = tripLine.get(trip);
                int seconds = GtfsCsv.seconds(r.get("departure_time"));
                if (line == null || seconds < 0
                        || Integer.parseInt(r.get("stop_sequence").trim()) >= lastSequence.get(trip)) {
                    return;
                }
                lastByStop.computeIfAbsent(r.get("stop_id"), k -> new HashMap<>())
                        .computeIfAbsent(line, k -> new HashMap<>())
                        .merge(tripService.get(trip), seconds, Math::max);
            });

            Map<String, ServicePattern> patterns = new HashMap<>();
            LocalDate[] range = {null, null};
            each(zip, "calendar.txt", r -> {
                boolean[] days = new boolean[7];
                String[] names = {"monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"};
                for (int i = 0; i < 7; i++) {
                    days[i] = "1".equals(r.get(names[i]));
                }
                LocalDate start = LocalDate.parse(r.get("start_date"), GTFS_DATE);
                LocalDate end = LocalDate.parse(r.get("end_date"), GTFS_DATE);
                patterns.put(r.get("service_id"), new ServicePattern(days, start, end));
                widen(range, start);
                widen(range, end);
            });

            Map<String, Map<LocalDate, Boolean>> exceptions = new HashMap<>();
            each(zip, "calendar_dates.txt", r -> {
                LocalDate date = LocalDate.parse(r.get("date"), GTFS_DATE);
                exceptions.computeIfAbsent(r.get("service_id"), k -> new HashMap<>())
                        .put(date, "1".equals(r.get("exception_type")));
                widen(range, date);
            });

            if (range[0] == null) {
                throw new IllegalStateException("timetable has no service dates");
            }
            log.info("GTFS timetable loaded from {}: {} stops, {} trips, valid {} to {} ({} ms)", path,
                    stopNames.size(), tripLine.size(), range[0], range[1], System.currentTimeMillis() - started);
            return new Timetable(stopNames, lastByStop, patterns, exceptions, range[0], range[1]);
        }
    }

    // Extends [min, max] to include date.
    private static void widen(LocalDate[] range, LocalDate date) {
        if (range[0] == null || date.isBefore(range[0])) {
            range[0] = date;
        }
        if (range[1] == null || date.isAfter(range[1])) {
            range[1] = date;
        }
    }

    // Streams one file of the zip row by row (optional files that are missing are skipped).
    private static void each(ZipFile zip, String name, java.util.function.Consumer<Map<String, String>> handler)
            throws IOException {
        ZipEntry entry = zip.getEntry(name);
        if (entry == null) {
            if ("calendar_dates.txt".equals(name) || "calendar.txt".equals(name)) {
                return;
            }
            throw new IOException(name + " missing from GTFS file");
        }
        try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(zip.getInputStream(entry), StandardCharsets.UTF_8))) {
            GtfsCsv.read(reader, handler);
        }
    }
}
