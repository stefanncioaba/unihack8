package com.unihack8.backend.transit.mapper.impl;

import static org.assertj.core.api.Assertions.assertThat;

import com.unihack8.backend.common.geo.GeoPoint;
import com.unihack8.backend.transit.domain.dto.ArrivalDto;
import com.unihack8.backend.transit.domain.dto.TransitRouteDto;
import com.unihack8.backend.transit.domain.dto.ShapeStopDto;
import com.unihack8.backend.transit.domain.dto.ShapeVariantDto;
import com.unihack8.backend.transit.domain.dto.TransitShapeDto;
import com.unihack8.backend.transit.domain.dto.VehicleDto;
import com.unihack8.backend.transit.domain.dto.stpt.StptArrival;
import com.unihack8.backend.transit.domain.dto.stpt.StptRoute;
import com.unihack8.backend.transit.domain.dto.stpt.StptVehicle;
import com.unihack8.backend.transit.domain.model.RouteShape;
import com.unihack8.backend.transit.domain.model.ShapePath;
import com.unihack8.backend.transit.domain.model.ShapeStop;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;

/** STPT -> API shape conversion. */
class TransitMapperImplTest {

    private final TransitMapperImpl mapper = new TransitMapperImpl();

    // Long name "A - B" gives from/to; colour gets a '#'.
    @Test
    void routeEndsAndColour() {
        TransitRouteDto r = mapper.toRoute(
                new StptRoute("1", "Gara de Nord - Piața Gh. Domășneanu (AEM)", "0", "tram", "e3a900"));
        assertThat(r).isEqualTo(new TransitRouteDto("1", "TRAM", "1", "Gara de Nord",
                "Piața Gh. Domășneanu (AEM)", "#e3a900"));
    }

    // Missing long name and colour become nulls.
    @Test
    void routeWithoutDetails() {
        TransitRouteDto r = mapper.toRoute(new StptRoute("S1", null, "3", "scolar", ""));
        assertThat(r.from()).isNull();
        assertThat(r.to()).isNull();
        assertThat(r.color()).isNull();
        assertThat(r.type()).isEqualTo("BUS");
    }

    // Category decides the type first, then GTFS route_type.
    @Test
    void routeTypes() {
        assertThat(type("trolleybus", "11")).isEqualTo("TROLLEYBUS");
        assertThat(type("express", "3")).isEqualTo("EXPRESS");
        assertThat(type("metropolitan", "3")).isEqualTo("METROPOLITAN");
        assertThat(type("vaporetto", "4")).isEqualTo("BOAT");
        assertThat(type("school", "3")).isEqualTo("SCHOOL");
        assertThat(type("urban", "3")).isEqualTo("BUS");
        assertThat(type(null, "0")).isEqualTo("TRAM");
        assertThat(type("other", "11")).isEqualTo("TROLLEYBUS");
        assertThat(type(null, "4")).isEqualTo("BOAT");
        assertThat(type(null, null)).isEqualTo("BUS");
    }

    // Shortcut: the type of a route with this category and GTFS type.
    private static String type(String category, String routeType) {
        return TransitMapperImpl.routeType(new StptRoute("x", null, routeType, category, null));
    }

    // lng -> lon, epoch ms -> Instant; line facts copied from the STPT line.
    @Test
    void vehicle() {
        TransitRouteDto line = new TransitRouteDto("1", "TRAM", "1", "A", "B", "#e3a900");
        VehicleDto v = mapper.toVehicle(new StptVehicle("1010", 45.7, 21.2, 20.5, 10.0, "1", "Gara de Nord",
                "Memorandumului", 1794594883000L, true), line);
        assertThat(v.lon()).isEqualTo(21.2);
        assertThat(v.speedKmh()).isEqualTo(10.0);
        assertThat(v.nextStop()).isEqualTo("Memorandumului");
        assertThat(v.reportedAt()).isEqualTo(Instant.ofEpochMilli(1794594883000L));
        assertThat(v.route()).isEqualTo("1");
        assertThat(v.routeName()).isEqualTo("1");
        assertThat(v.type()).isEqualTo("TRAM");
        assertThat(v.color()).isEqualTo("#e3a900");
    }

    // Unknown line: route/routeName from STPT's vehicle, no type or colour.
    @Test
    void vehicleWithoutLine() {
        VehicleDto v = mapper.toVehicle(new StptVehicle("GLM", 45.7, 21.2, null, null, "5c", null, null, null,
                null), null);
        assertThat(v.route()).isEqualTo("5c");
        assertThat(v.routeName()).isEqualTo("5c");
        assertThat(v.type()).isNull();
        assertThat(v.color()).isNull();
        assertThat(v.reportedAt()).isNull();
    }

    // Shape with an STPT line takes its id, name, type and colour; polylines are encoded.
    @Test
    void shapeWithLine() {
        RouteShape shape = new RouteShape("E2", "3", "ff0000",
                List.of(path(List.of(new GeoPoint(38.5, -120.2), new GeoPoint(40.7, -120.95)))));
        TransitShapeDto s = mapper.toShape(shape, new TransitRouteDto("E2", "EXPRESS", "E2", null, null, null));
        assertThat(s.route()).isEqualTo("E2");
        assertThat(s.type()).isEqualTo("EXPRESS");
        assertThat(s.color()).isNull();
        assertThat(s.polylines()).containsExactly("_p~iF~ps|U_ulLnnqC");
    }

    // Shape without an STPT line uses the GTFS route_type and colour.
    @Test
    void shapeWithoutLine() {
        RouteShape shape = new RouteShape("1", "0", "e3a900",
                List.of(path(List.of(new GeoPoint(45.7, 21.2), new GeoPoint(45.71, 21.21)))));
        TransitShapeDto s = mapper.toShape(shape, null);
        assertThat(s.route()).isEqualTo("1");
        assertThat(s.routeName()).isEqualTo("1");
        assertThat(s.type()).isEqualTo("TRAM");
        assertThat(s.color()).isEqualTo("#e3a900");
        assertThat(s.polylines()).hasSize(1);
    }

    // Each path becomes a variant with its polyline, TUR/RETUR direction, headsign and ordered stops.
    @Test
    void shapeVariants() {
        List<GeoPoint> there = List.of(new GeoPoint(45.7, 21.2), new GeoPoint(45.71, 21.21));
        List<GeoPoint> back = List.of(new GeoPoint(45.71, 21.21), new GeoPoint(45.7, 21.2));
        RouteShape shape = new RouteShape("1", "0", null, List.of(
                new ShapePath(there, 0, "Gara de Nord", List.of(new ShapeStop("1", "A", 45.7, 21.2),
                        new ShapeStop("2", "Gara de Nord", 45.71, 21.21))),
                new ShapePath(back, 1, "A", List.of()),
                new ShapePath(there, null, null, null)));
        TransitShapeDto s = mapper.toShape(shape, null);
        assertThat(s.variants()).hasSize(3);
        assertThat(s.variants()).extracting(ShapeVariantDto::polyline).containsExactlyElementsOf(s.polylines());
        assertThat(s.variants()).extracting(ShapeVariantDto::direction).containsExactly("TUR", "RETUR", null);
        assertThat(s.variants().get(0).headsign()).isEqualTo("Gara de Nord");
        assertThat(s.variants().get(0).stops()).containsExactly(new ShapeStopDto("1", "A", 45.7, 21.2),
                new ShapeStopDto("2", "Gara de Nord", 45.71, 21.21));
        assertThat(s.variants().get(2).stops()).isEmpty();

        TransitShapeDto light = mapper.withoutStops(s);
        assertThat(light.polylines()).isEqualTo(s.polylines());
        assertThat(light.variants()).allSatisfy(v -> assertThat(v.stops()).isNull());
        assertThat(light.variants()).extracting(ShapeVariantDto::headsign).containsExactly("Gara de Nord", "A", null);
        assertThat(TransitMapperImpl.direction(2)).isNull();
    }

    // A path with no direction, headsign or stops.
    private static ShapePath path(List<GeoPoint> points) {
        return new ShapePath(points, null, null, List.of());
    }

    // Times are Romanian local time (UTC+2 in November), duplicates removed, only the first is live.
    @Test
    void arrivalsConvertLocalTimes() {
        Instant now = Instant.parse("2026-11-13T18:35:00Z"); // 20:35 in Timișoara
        List<ArrivalDto> list = mapper.toArrivals(
                new StptArrival("9", "tv", "Piața Gh. Domășneanu", "1031",
                        List.of("20:40|5", "21:10|36", "21:10|36")), now);

        assertThat(list).hasSize(2);
        assertThat(list.get(0)).isEqualTo(new ArrivalDto("9", "Piața Gh. Domășneanu",
                Instant.parse("2026-11-13T18:40:00Z"), 5, true));
        assertThat(list.get(1).arrivesAt()).isEqualTo(Instant.parse("2026-11-13T19:10:00Z"));
        assertThat(list.get(1).live()).isFalse();
    }

    // Without a vehicle id nothing is live.
    @Test
    void timetableArrivalsAreNotLive() {
        List<ArrivalDto> list = mapper.toArrivals(
                new StptArrival("2", "tv", "Shopping City", null, List.of("20:45|10")),
                Instant.parse("2026-11-13T18:35:00Z"));
        assertThat(list).singleElement().extracting(ArrivalDto::live).isEqualTo(false);
    }

    // 00:05 seen at 23:50 local is tomorrow, not this morning.
    @Test
    void arrivalAfterMidnightIsNextDay() {
        Instant now = Instant.parse("2026-11-13T21:50:00Z"); // 23:50 local
        List<ArrivalDto> list = mapper.toArrivals(
                new StptArrival("1", "tv", "Gara de Nord", null, List.of("00:05|15")), now);
        assertThat(list.get(0).arrivesAt()).isEqualTo(Instant.parse("2026-11-13T22:05:00Z"));
        assertThat(list.get(0).minutes()).isEqualTo(15);
    }

    // Missing minutes are computed; unreadable entries are skipped.
    @Test
    void arrivalsWithMissingParts() {
        Instant now = Instant.parse("2026-11-13T18:35:00Z");
        List<ArrivalDto> list = mapper.toArrivals(
                new StptArrival("2", "tv", "Shopping City", null, List.of("20:55", "garbage", "x|7")), now);
        assertThat(list).hasSize(2);
        assertThat(list.get(0).minutes()).isEqualTo(20);
        assertThat(list.get(1).arrivesAt()).isEqualTo(Instant.parse("2026-11-13T18:42:00Z"));
        assertThat(mapper.toArrivals(new StptArrival("2", "tv", "x", null, null), now)).isEmpty();
    }
}
