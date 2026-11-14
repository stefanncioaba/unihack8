package com.unihack8.backend.transit.repository.impl;

import static org.assertj.core.api.Assertions.assertThat;

import com.unihack8.backend.common.geo.GeoPoint;
import com.unihack8.backend.transit.domain.model.RouteShape;
import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

/** Line paths from a small GTFS file: shapes.txt first, stop sequences as fallback. */
class GtfsShapeRepositoryTest {

    private static final String STOPS = """
            stop_id,stop_name,stop_lat,stop_lon
            1,A,45.70,21.20
            2,B,45.71,21.21
            3,C,45.72,21.22
            """;
    private static final String ROUTES = """
            route_id,agency_id,route_short_name,route_long_name,route_type,route_color
            R_TV_1,STPT,1,A - C,0,e3a900
            R_AB_5B,STPT,5b,C - A,3,
            """;
    private static final String STOP_TIMES = """
            trip_id,arrival_time,departure_time,stop_id,stop_sequence
            t1,10:00:00,10:00:00,1,1
            t1,10:05:00,10:05:00,2,2
            t1,10:10:00,10:10:00,3,3
            t3,11:10:00,11:10:00,1,3
            t3,11:00:00,11:00:00,3,1
            t3,11:05:00,11:05:00,2,2
            t4,12:00:00,12:00:00,3,1
            t4,12:05:00,12:05:00,2,2
            t4,12:10:00,12:10:00,1,3
            """;

    @TempDir
    Path dir;

    // Writes a GTFS zip with the given files.
    private Path zip(Map<String, String> files) throws IOException {
        Path zip = dir.resolve("gtfs-" + files.hashCode() + ".zip");
        try (OutputStream out = Files.newOutputStream(zip); ZipOutputStream z = new ZipOutputStream(out)) {
            for (Map.Entry<String, String> f : files.entrySet()) {
                z.putNextEntry(new ZipEntry(f.getKey()));
                z.write(f.getValue().getBytes(StandardCharsets.UTF_8));
                z.closeEntry();
            }
        }
        return zip;
    }

    // Base file set; trips and shapes vary per test.
    private Map<String, String> files(String trips, String shapes) {
        Map<String, String> files = new LinkedHashMap<>();
        files.put("stops.txt", STOPS);
        files.put("routes.txt", ROUTES);
        files.put("trips.txt", trips);
        files.put("stop_times.txt", STOP_TIMES);
        if (shapes != null) {
            files.put("shapes.txt", shapes);
        }
        return files;
    }

    // Line 1 uses shapes.txt (two directions; the repeated shape id is kept once, points sorted by sequence).
    // The middle point is a real bend (about 400 m off the straight line), so simplification keeps it.
    @Test
    void shapesFromShapesTxt() throws IOException {
        Path zip = zip(files("""
                route_id,service_id,trip_id,trip_headsign,direction_id,shape_id
                R_TV_1,WD,t1,C,0,1_T
                R_TV_1,WD,t2,C,0,1_T
                R_TV_1,WD,t3,A,1,1_R
                """, """
                shape_id,shape_pt_lat,shape_pt_lon,shape_pt_sequence
                1_T,45.70,21.20,1
                1_T,45.705,21.21,2
                1_T,45.705,21.21,3
                1_T,45.72,21.22,4
                1_R,45.71,21.21,2
                1_R,45.72,21.22,1
                """));

        List<RouteShape> shapes = new GtfsShapeRepository(zip).shapes();

        assertThat(shapes).singleElement().satisfies(s -> {
            assertThat(s.routeName()).isEqualTo("1");
            assertThat(s.routeType()).isEqualTo("0");
            assertThat(s.color()).isEqualTo("e3a900");
            assertThat(s.paths()).containsExactly(
                    List.of(new GeoPoint(45.70, 21.20), new GeoPoint(45.705, 21.21), new GeoPoint(45.72, 21.22)),
                    List.of(new GeoPoint(45.72, 21.22), new GeoPoint(45.71, 21.21)));
        });
    }

    // A dense, straight shape is simplified to its ends (Douglas-Peucker, 5 m); stop-sequence paths are not.
    @Test
    void shapesAreSimplified() throws IOException {
        String nl = "\n";
        StringBuilder shape = new StringBuilder("shape_id,shape_pt_lat,shape_pt_lon,shape_pt_sequence" + nl);
        for (int i = 0; i <= 100; i++) {
            shape.append("1_T,").append(45.70 + i * 0.0001).append(",21.20,").append(i + 1).append(nl);
        }
        Path zip = zip(files("""
                route_id,service_id,trip_id,trip_headsign,direction_id,shape_id
                R_TV_1,WD,t1,C,0,1_T
                R_AB_5B,WD,t3,A,1,
                """, shape.toString()));

        List<RouteShape> shapes = new GtfsShapeRepository(zip).shapes();

        assertThat(shapes.get(0).paths()).singleElement().satisfies(p -> assertThat(p).hasSize(2));
        // 5b falls back to its 3 collinear stops: all kept.
        assertThat(shapes.get(1).paths()).singleElement().satisfies(p -> assertThat(p).hasSize(3));
    }

    // Without shapes.txt every line is drawn through its trips' stops in stop_sequence order.
    @Test
    void stopSequenceFallback() throws IOException {
        Path zip = zip(files("""
                route_id,service_id,trip_id,trip_headsign,direction_id
                R_TV_1,WD,t1,C,0
                R_AB_5B,WD,t3,A,1
                R_AB_5B,WD,t4,A,1
                """, null));

        List<RouteShape> shapes = new GtfsShapeRepository(zip).shapes();

        assertThat(shapes).extracting(RouteShape::routeName).containsExactly("1", "5b");
        assertThat(shapes.get(0).paths()).containsExactly(
                List.of(new GeoPoint(45.70, 21.20), new GeoPoint(45.71, 21.21), new GeoPoint(45.72, 21.22)));
        // t3 and t4 follow the same stops: one path; no colour in routes.txt stays null.
        assertThat(shapes.get(1).paths()).containsExactly(
                List.of(new GeoPoint(45.72, 21.22), new GeoPoint(45.71, 21.21), new GeoPoint(45.70, 21.20)));
        assertThat(shapes.get(1).color()).isNull();
    }

    // A trip whose shape id is missing from shapes.txt falls back to its stops; others keep their shape.
    @Test
    void mixedShapesAndFallback() throws IOException {
        Path zip = zip(files("""
                route_id,service_id,trip_id,trip_headsign,direction_id,shape_id
                R_TV_1,WD,t1,C,0,1_T
                R_AB_5B,WD,t3,A,1,missing
                """, """
                shape_id,shape_pt_lat,shape_pt_lon,shape_pt_sequence
                1_T,45.70,21.20,1
                1_T,45.72,21.22,2
                """));

        List<RouteShape> shapes = new GtfsShapeRepository(zip).shapes();

        assertThat(shapes).extracting(RouteShape::routeName).containsExactly("1", "5b");
        assertThat(shapes.get(0).paths()).singleElement().satisfies(p -> assertThat(p).hasSize(2));
        assertThat(shapes.get(1).paths()).singleElement().satisfies(p -> assertThat(p).hasSize(3));
    }

    // No file: empty list, nothing thrown, and the answer is remembered.
    @Test
    void missingFile() {
        GtfsShapeRepository repo = new GtfsShapeRepository(dir.resolve("absent.zip"));
        assertThat(repo.shapes()).isEmpty();
        assertThat(repo.shapes()).isEmpty();
    }

    // The bundled STPT feed (when present) has shapes for the tram lines.
    @Test
    void realFeedWhenPresent() {
        Path real = GtfsTimetableRepository.resolve(Path.of("../infra/otp/stpt-gtfs.zip"));
        org.junit.jupiter.api.Assumptions.assumeTrue(Files.exists(real), "no bundled GTFS file");
        List<RouteShape> shapes = new GtfsShapeRepository(real).shapes();
        assertThat(shapes).isNotEmpty();
        assertThat(shapes).anySatisfy(s -> {
            assertThat(s.routeName()).isEqualTo("1");
            assertThat(s.paths()).isNotEmpty();
        });
        // shapes.txt has 41,729 points; simplified, the app draws well under a third of them (about 9,700).
        int points = shapes.stream().flatMap(s -> s.paths().stream()).mapToInt(List::size).sum();
        assertThat(points).isLessThan(14_000);
    }
}
