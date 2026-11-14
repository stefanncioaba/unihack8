package com.unihack8.backend.transit.repository.impl;

import com.unihack8.backend.common.geo.GeoPoint;
import com.unihack8.backend.transit.config.StptProperties;
import com.unihack8.backend.transit.domain.model.RouteShape;
import com.unihack8.backend.transit.domain.model.ShapePath;
import com.unihack8.backend.transit.domain.model.ShapeStop;
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
import java.util.TreeSet;
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
 * joined into a line. Identical paths are kept once. Each path carries the direction_id, headsign and ordered
 * stops of one representative trip (the first trip using that shape). Shapes are simplified (Douglas-Peucker, 5 m, see
 * PathSimplifier) so the app draws a fraction of the points; the sparse stop-sequence paths are kept as they are.
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

    /** Trip facts from trips.txt: its route, GTFS direction_id (may be null) and headsign (may be null). */
    private record TripInfo(String route, Integer directionId, String headsign) {
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

    // Reads routes, trips, shapes, stops and the stop_times of one representative trip per path.
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

            // Per route: shape ids in first-seen order; per shape: the first trip using it (its representative).
            Map<String, Set<String>> routeShapeIds = new LinkedHashMap<>();
            Map<String, TripInfo> trips = new HashMap<>();
            Map<String, String> tripShape = new HashMap<>();
            Map<String, String> shapeTrip = new HashMap<>();
            each(zip, "trips.txt", true, r -> {
                String route = r.get("route_id");
                String trip = r.get("trip_id");
                String shape = blankToNull(r.get("shape_id"));
                trips.put(trip, new TripInfo(route, integer(r.getOrDefault("direction_id", "")),
                        blankToNull(r.get("trip_headsign"))));
                if (shape != null) {
                    tripShape.put(trip, shape);
                    shapeTrip.putIfAbsent(shape, trip);
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
            for (String trip : trips.keySet()) {
                String shape = tripShape.get(trip);
                if (shape == null || !shapePoints.containsKey(shape)) {
                    fallbackTrips.add(trip);
                }
            }
            // Stops are read for every representative trip; required only when some path is drawn from them.
            Set<String> wantedTrips = new HashSet<>(fallbackTrips);
            for (Map.Entry<String, String> e : shapeTrip.entrySet()) {
                if (shapePoints.containsKey(e.getKey())) {
                    wantedTrips.add(e.getValue());
                }
            }
            boolean stopsRequired = !fallbackTrips.isEmpty();
            Map<String, ShapeStop> stops = readStops(zip, stopsRequired);
            Map<String, List<ShapeStop>> tripStops = readTripStops(zip, wantedTrips, stops, stopsRequired);

            // Fallback paths per route, trips sorted by id so the output order does not depend on hash order.
            Map<String, List<ShapePath>> fallbackPaths = new HashMap<>();
            for (String trip : new TreeSet<>(fallbackTrips)) {
                List<ShapeStop> ordered = tripStops.getOrDefault(trip, List.of());
                List<GeoPoint> points = ordered.stream().map(st -> new GeoPoint(st.lat(), st.lon())).toList();
                TripInfo info = trips.get(trip);
                fallbackPaths.computeIfAbsent(info.route(), k -> new ArrayList<>())
                        .add(new ShapePath(points, info.directionId(), headsign(info, ordered), ordered));
            }

            List<RouteShape> result = new ArrayList<>();
            for (Map.Entry<String, RouteInfo> route : routes.entrySet()) {
                // Identical paths are kept once (the first one, with its trip's direction and stops).
                Map<List<GeoPoint>, ShapePath> paths = new LinkedHashMap<>();
                for (String shapeId : routeShapeIds.getOrDefault(route.getKey(), Set.of())) {
                    TreeMap<Integer, GeoPoint> points = shapePoints.get(shapeId);
                    if (points != null) {
                        String trip = shapeTrip.get(shapeId);
                        TripInfo info = trips.get(trip);
                        List<ShapeStop> ordered = tripStops.getOrDefault(trip, List.of());
                        addPath(paths, new ShapePath(PathSimplifier.simplify(new ArrayList<>(points.values()),
                                PathSimplifier.SHAPE_TOLERANCE_METERS), info.directionId(), headsign(info, ordered),
                                ordered));
                    }
                }
                for (ShapePath p : fallbackPaths.getOrDefault(route.getKey(), List.of())) {
                    addPath(paths, p);
                }
                if (!paths.isEmpty()) {
                    RouteInfo info = route.getValue();
                    result.add(new RouteShape(info.name(), info.type(), info.color(), List.copyOf(paths.values())));
                }
            }
            int rawPoints = shapePoints.values().stream().mapToInt(Map::size).sum();
            int drawnPoints = result.stream().flatMap(r -> r.paths().stream()).mapToInt(p -> p.points().size()).sum();
            log.info("Line shapes loaded from {}: {} lines, {} trips drawn from stop sequences, {} shape points"
                            + " simplified to {} drawn points ({} ms)", path, result.size(), fallbackTrips.size(),
                    rawPoints, drawnPoints, System.currentTimeMillis() - started);
            return List.copyOf(result);
        }
    }

    // Every stop with a readable position, by stop_id.
    private static Map<String, ShapeStop> readStops(ZipFile zip, boolean required) throws IOException {
        Map<String, ShapeStop> stops = new HashMap<>();
        each(zip, "stops.txt", required, r -> {
            GeoPoint p = point(r.get("stop_lat"), r.get("stop_lon"));
            if (p != null) {
                String id = r.get("stop_id");
                stops.put(id, new ShapeStop(id, blankToNull(r.get("stop_name")), p.lat(), p.lon()));
            }
        });
        return stops;
    }

    // The ordered stops (stop_sequence) of the given trips; stops missing from stops.txt are skipped.
    private static Map<String, List<ShapeStop>> readTripStops(ZipFile zip, Set<String> trips,
                                                              Map<String, ShapeStop> stops, boolean required)
            throws IOException {
        if (trips.isEmpty()) {
            return Map.of();
        }
        Map<String, TreeMap<Integer, String>> byTrip = new HashMap<>();
        each(zip, "stop_times.txt", required, r -> {
            String trip = r.get("trip_id");
            if (trips.contains(trip)) {
                Integer seq = integer(r.get("stop_sequence"));
                if (seq != null) {
                    byTrip.computeIfAbsent(trip, k -> new TreeMap<>()).put(seq, r.get("stop_id"));
                }
            }
        });
        Map<String, List<ShapeStop>> result = new HashMap<>();
        for (Map.Entry<String, TreeMap<Integer, String>> trip : byTrip.entrySet()) {
            List<ShapeStop> ordered = new ArrayList<>();
            for (String stopId : trip.getValue().values()) {
                ShapeStop stop = stops.get(stopId);
                if (stop != null) {
                    ordered.add(stop);
                }
            }
            result.put(trip.getKey(), List.copyOf(ordered));
        }
        return result;
    }

    // The trip's headsign, or the name of its last stop when the feed has none.
    private static String headsign(TripInfo trip, List<ShapeStop> stops) {
        if (trip.headsign() != null) {
            return trip.headsign();
        }
        return stops.isEmpty() ? null : stops.get(stops.size() - 1).name();
    }

    // Adds a path without consecutive duplicate points; paths with fewer than 2 points are dropped, and a path
    // whose points are already there is skipped.
    private static void addPath(Map<List<GeoPoint>, ShapePath> paths, ShapePath path) {
        List<GeoPoint> clean = new ArrayList<>();
        for (GeoPoint p : path.points()) {
            if (clean.isEmpty() || !clean.get(clean.size() - 1).equals(p)) {
                clean.add(p);
            }
        }
        if (clean.size() >= 2) {
            List<GeoPoint> key = List.copyOf(clean);
            paths.putIfAbsent(key, new ShapePath(key, path.directionId(), path.headsign(), path.stops()));
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
