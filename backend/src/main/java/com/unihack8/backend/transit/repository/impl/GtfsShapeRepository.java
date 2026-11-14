package com.unihack8.backend.transit.repository.impl;

import com.unihack8.backend.common.geo.GeoPoint;
import com.unihack8.backend.transit.config.StptProperties;
import com.unihack8.backend.transit.domain.model.RouteShape;
import com.unihack8.backend.transit.repository.ShapeRepository;
import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.function.Consumer;
import java.util.zip.ZipEntry;
import java.util.zip.ZipFile;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Repository;

/**
 * Builds each line's paths from the STPT GTFS zip: one path per distinct shape_id its trips use
 * (shapes.txt). Trips without a usable shape fall back to their ordered stops (stop_times.txt)
 * joined into a line. Identical paths are kept once.
 */
@Repository
public class GtfsShapeRepository implements ShapeRepository {

    private static final Logger log = LoggerFactory.getLogger(GtfsShapeRepository.class);

    private final Path zipPath;
    private volatile List<RouteShape> shapes;
    private volatile boolean loadAttempted;

    /** Line facts from routes.txt. */
    private record RouteInfo(String name, String type, String color) {
    }

    // Spring: same file as the timetable (stpt.gtfs-path, or infra/otp/stpt-gtfs.zip from the repo root).
    @Autowired
    public GtfsShapeRepository(StptProperties props) {
        this(GtfsTimetableRepository.resolve(Path.of(props.gtfsPath())));
    }

    // Tests: an explicit file.
    public GtfsShapeRepository(Path zipPath) {
        this.zipPath = zipPath;
    }

    // Loads once; a missing or broken file is logged once and answers an empty list.
    @Override
    public List<RouteShape> shapes() {
        if (loadAttempted) {
            return shapes;
        }
        synchronized (this) {
            if (!loadAttempted) {
                shapes = List.of();
                try {
                    if (!Files.exists(zipPath)) {
                        log.warn("GTFS file not found at {} (run infra/otp/get-data.sh); no line shapes",
                                zipPath.toAbsolutePath());
                    } else {
                        shapes = parse(zipPath);
                    }
                } catch (IOException | RuntimeException e) {
                    log.warn("Could not read line shapes from {}: {}", zipPath, e.toString());
                } finally {
                    loadAttempted = true;
                }
            }
            return shapes;
        }
    }

    // Reads routes, trips, shapes and (only when some trip has no shape) stops + stop_times.
    private static List<RouteShape> parse(Path path) throws IOException {
        long started = System.currentTimeMillis();
        try (ZipFile zip = new ZipFile(path.toFile(), StandardCharsets.UTF_8)) {
            Map<String, RouteInfo> routes = new LinkedHashMap<>();
            each(zip, "routes.txt", true, r -> {
                String shortName = r.getOrDefault("route_short_name", "").trim();
                String name = shortName.isBlank() ? r.getOrDefault("route_long_name", "").trim() : shortName;
                routes.put(r.get("route_id"), new RouteInfo(name.isBlank() ? r.get("route_id") : name,
                        blankToNull(r.get("route_type")), blankToNull(r.get("route_color"))));
            });

            // Per route: shape ids in first-seen order.
            Map<String, Set<String>> routeShapeIds = new LinkedHashMap<>();
            Map<String, String> tripRoute = new HashMap<>();
            Map<String, String> tripShape = new HashMap<>();
            each(zip, "trips.txt", true, r -> {
                String route = r.get("route_id");
                String shape = blankToNull(r.get("shape_id"));
                tripRoute.put(r.get("trip_id"), route);
                if (shape != null) {
                    tripShape.put(r.get("trip_id"), shape);
                    routeShapeIds.computeIfAbsent(route, k -> new LinkedHashSet<>()).add(shape);
                }
            });

            Map<String, TreeMap<Integer, GeoPoint>> shapePoints = new HashMap<>();
            each(zip, "shapes.txt", false, r -> {
                GeoPoint p = point(r.get("shape_pt_lat"), r.get("shape_pt_lon"));
                Integer seq = integer(r.get("shape_pt_sequence"));
                if (p != null && seq != null) {
                    shapePoints.computeIfAbsent(r.get("shape_id"), k -> new TreeMap<>()).put(seq, p);
                }
            });

            // Trips whose shape is missing (no shape_id, or the id is not in shapes.txt).
            Set<String> fallbackTrips = new HashSet<>();
            for (String trip : tripRoute.keySet()) {
                String shape = tripShape.get(trip);
                if (shape == null || !shapePoints.containsKey(shape)) {
                    fallbackTrips.add(trip);
                }
            }
            Map<String, List<List<GeoPoint>>> fallbackPaths = fallbackTrips.isEmpty()
                    ? Map.of() : stopSequencePaths(zip, fallbackTrips, tripRoute);

            List<RouteShape> result = new ArrayList<>();
            for (Map.Entry<String, RouteInfo> route : routes.entrySet()) {
                Set<List<GeoPoint>> paths = new LinkedHashSet<>();
                for (String shapeId : routeShapeIds.getOrDefault(route.getKey(), Set.of())) {
                    TreeMap<Integer, GeoPoint> points = shapePoints.get(shapeId);
                    if (points != null) {
                        addPath(paths, new ArrayList<>(points.values()));
                    }
                }
                for (List<GeoPoint> p : fallbackPaths.getOrDefault(route.getKey(), List.of())) {
                    addPath(paths, p);
                }
                if (!paths.isEmpty()) {
                    RouteInfo info = route.getValue();
                    result.add(new RouteShape(info.name(), info.type(), info.color(), List.copyOf(paths)));
                }
            }
            log.info("Line shapes loaded from {}: {} lines, {} trips drawn from stop sequences ({} ms)", path,
                    result.size(), fallbackTrips.size(), System.currentTimeMillis() - started);
            return List.copyOf(result);
        }
    }

    // Ordered stop positions of each fallback trip, grouped by route.
    private static Map<String, List<List<GeoPoint>>> stopSequencePaths(ZipFile zip, Set<String> trips,
                                                                      Map<String, String> tripRoute)
            throws IOException {
        Map<String, GeoPoint> stops = new HashMap<>();
        each(zip, "stops.txt", true, r -> {
            GeoPoint p = point(r.get("stop_lat"), r.get("stop_lon"));
            if (p != null) {
                stops.put(r.get("stop_id"), p);
            }
        });
        Map<String, TreeMap<Integer, String>> tripStops = new HashMap<>();
        each(zip, "stop_times.txt", true, r -> {
            String trip = r.get("trip_id");
            Integer seq = integer(r.get("stop_sequence"));
            if (trips.contains(trip) && seq != null) {
                tripStops.computeIfAbsent(trip, k -> new TreeMap<>()).put(seq, r.get("stop_id"));
            }
        });
        Map<String, List<List<GeoPoint>>> byRoute = new HashMap<>();
        // Sorted trip ids so the output order does not depend on hash order.
        for (Map.Entry<String, TreeMap<Integer, String>> trip : new TreeMap<>(tripStops).entrySet()) {
            List<GeoPoint> path = new ArrayList<>();
            for (String stopId : trip.getValue().values()) {
                GeoPoint p = stops.get(stopId);
                if (p != null) {
                    path.add(p);
                }
            }
            byRoute.computeIfAbsent(tripRoute.get(trip.getKey()), k -> new ArrayList<>()).add(path);
        }
        return byRoute;
    }

    // Adds a path without consecutive duplicate points; paths with fewer than 2 points are dropped.
    private static void addPath(Set<List<GeoPoint>> paths, List<GeoPoint> points) {
        List<GeoPoint> clean = new ArrayList<>();
        for (GeoPoint p : points) {
            if (clean.isEmpty() || !clean.get(clean.size() - 1).equals(p)) {
                clean.add(p);
            }
        }
        if (clean.size() >= 2) {
            paths.add(List.copyOf(clean));
        }
    }

    // "45.7","21.2" -> point, or null when unreadable / out of range.
    private static GeoPoint point(String lat, String lon) {
        try {
            return new GeoPoint(Double.parseDouble(lat.trim()), Double.parseDouble(lon.trim()));
        } catch (RuntimeException e) {
            return null;
        }
    }

    // Integer value, or null when unreadable.
    private static Integer integer(String value) {
        try {
            return Integer.parseInt(value.trim());
        } catch (RuntimeException e) {
            return null;
        }
    }

    // Trimmed text, null when blank.
    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    // Streams one file of the zip row by row; a missing optional file is skipped.
    private static void each(ZipFile zip, String name, boolean required, Consumer<Map<String, String>> handler)
            throws IOException {
        ZipEntry entry = zip.getEntry(name);
        if (entry == null) {
            if (required) {
                throw new IOException(name + " missing from GTFS file");
            }
            return;
        }
        try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(zip.getInputStream(entry), StandardCharsets.UTF_8))) {
            GtfsCsv.read(reader, handler);
        }
    }
}
