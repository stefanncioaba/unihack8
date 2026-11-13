package com.unihack8.backend.transit.mapper.impl;

import static org.assertj.core.api.Assertions.assertThat;

import com.unihack8.backend.transit.domain.dto.ArrivalDto;
import com.unihack8.backend.transit.domain.dto.TransitRouteDto;
import com.unihack8.backend.transit.domain.dto.VehicleDto;
import com.unihack8.backend.transit.domain.dto.stpt.StptArrival;
import com.unihack8.backend.transit.domain.dto.stpt.StptRoute;
import com.unihack8.backend.transit.domain.dto.stpt.StptVehicle;
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

    // lng -> lon, epoch ms -> Instant.
    @Test
    void vehicle() {
        VehicleDto v = mapper.toVehicle(new StptVehicle("1010", 45.7, 21.2, 20.5, 10.0, "1", "Gara de Nord",
                "Memorandumului", 1794594883000L, true));
        assertThat(v.lon()).isEqualTo(21.2);
        assertThat(v.speedKmh()).isEqualTo(10.0);
        assertThat(v.nextStop()).isEqualTo("Memorandumului");
        assertThat(v.reportedAt()).isEqualTo(Instant.ofEpochMilli(1794594883000L));
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
