package com.unihack8.backend.transit.service.impl;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.unihack8.backend.common.exception.ApiException;
import com.unihack8.backend.common.exception.ErrorCode;
import com.unihack8.backend.common.geo.BoundingBox;
import com.unihack8.backend.common.geo.GeoPoint;
import com.unihack8.backend.support.MutableClock;
import com.unihack8.backend.transit.client.StptClient;
import com.unihack8.backend.transit.config.StptProperties;
import com.unihack8.backend.transit.domain.dto.ArrivalsResponse;
import com.unihack8.backend.transit.domain.dto.LastDepartureDto;
import com.unihack8.backend.transit.domain.dto.LastDeparturesResponse;
import com.unihack8.backend.transit.domain.dto.TransitRouteDto;
import com.unihack8.backend.transit.domain.dto.TransitShapeDto;
import com.unihack8.backend.transit.domain.dto.VehicleDto;
import com.unihack8.backend.transit.domain.dto.TransitSummaryResponse;
import com.unihack8.backend.transit.domain.dto.VehiclesResponse;
import com.unihack8.backend.transit.domain.dto.stpt.StptAlert;
import com.unihack8.backend.transit.domain.dto.stpt.StptArrival;
import com.unihack8.backend.transit.domain.dto.stpt.StptRoute;
import com.unihack8.backend.transit.domain.dto.stpt.StptStop;
import com.unihack8.backend.transit.domain.dto.stpt.StptVehicle;
import com.unihack8.backend.transit.domain.model.RouteShape;
import com.unihack8.backend.transit.domain.model.ScheduledDeparture;
import com.unihack8.backend.transit.mapper.impl.TransitMapperImpl;
import com.unihack8.backend.transit.repository.ShapeRepository;
import com.unihack8.backend.transit.repository.TimetableRepository;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

/** Transit service logic with a fake STPT and a controllable clock (PLAN 9.2–9.7). */
class TransitServiceImplTest {

    // 20:35 in Timișoara.
    private static final Instant NOW = Instant.parse("2026-11-13T18:35:00Z");

    private final StptClient stpt = mock(StptClient.class);
    private final TimetableRepository timetable = mock(TimetableRepository.class);
    private final ShapeRepository shapeRepository = mock(ShapeRepository.class);
    private final MutableClock clock = new MutableClock(NOW);
    private TransitServiceImpl service;

    // Fresh service (empty caches) and a small STPT network for every test.
    @BeforeEach
    void setUp() {
        StptProperties props = new StptProperties("https://live.stpt.test", Duration.ofSeconds(3),
                Duration.ofSeconds(5), "test", new StptProperties.Ttl(Duration.ofSeconds(10),
                Duration.ofSeconds(20), Duration.ofMinutes(5), Duration.ofHours(24)), "unused.zip");
        // No timetable unless a test says otherwise (Mockito answers Optional.empty()).
        service = new TransitServiceImpl(stpt, new TransitMapperImpl(), timetable, shapeRepository, clock, props);

        when(stpt.fetchStops()).thenReturn(List.of(
                new StptStop("1", "Dâmbovița (Ion Barac)", 45.74015, 21.19611, List.of("2", "9")),
                new StptStop("10", "Calea Șagului (Bd. L. Rebreanu)", 45.73255, 21.20934, List.of("9")),
                new StptStop("1000", "City of Mara (Lidl)", 45.75474, 21.21643, List.of("5b"))));
        when(stpt.fetchRoutes()).thenReturn(List.of(
                new StptRoute("M14", "A - B", "11", "trolleybus", "6f2095"),
                new StptRoute("E4b", "C - D", "3", "express", null),
                new StptRoute("11", "E - F", "11", "trolleybus", "6f2095"),
                new StptRoute("9", "G - H", "0", "tram", "e3a900"),
                new StptRoute("2", "Stația Meteo - Shopping City", "0", "tram", "e3a900"),
                new StptRoute("13", "I - J", "3", "urban", null)));
        when(stpt.fetchArrivals("1")).thenReturn(List.of(
                new StptArrival("9", "tv", "Piața Gh. Domășneanu", null,
                        List.of("20:40|5", "20:56|22", "21:10|36", "21:10|36")),
                new StptArrival("2", "tv", "Shopping City", "1040", List.of("20:45|10", "21:00|25"))));
        when(stpt.fetchAlerts()).thenReturn(List.of(new StptAlert("A155", "Trams diverted", "Details")));
    }

    // Trams first, then trolleybuses (2 before 11, plain numbers before M14), buses, express.
    @Test
    void routesSortedByTypeThenNumber() {
        assertThat(service.routes()).extracting(TransitRouteDto::id)
                .containsExactly("2", "9", "11", "M14", "13", "E4b");
    }

    // Static data is fetched once per day, not per request.
    @Test
    void routesAreCached() {
        service.routes();
        clock.advance(Duration.ofHours(23));
        service.routes();
        verify(stpt, times(1)).fetchRoutes();
    }

    // bbox keeps only stops inside the viewport.
    @Test
    void stopsFilteredByBbox() {
        assertThat(service.stops(null)).hasSize(3);
        assertThat(service.stops(BoundingBox.parse("21.19,45.735,21.20,45.745", "bbox")))
                .singleElement().satisfies(s -> assertThat(s.id()).isEqualTo("1"));
    }

    // Vehicles carry the fetch time, are not stale on success, and carry their line's type and colour.
    @Test
    void vehiclesFresh() {
        when(stpt.fetchVehicles("2")).thenReturn(List.of(
                new StptVehicle("1010", 45.7, 21.2, 10.0, 5.0, "2", "Shopping City", "X", 1L, true)));
        VehiclesResponse r = service.vehicles(" 2 ");
        assertThat(r.route()).isEqualTo("2");
        assertThat(r.stale()).isFalse();
        assertThat(r.updatedAt()).isEqualTo(NOW);
        assertThat(r.vehicles()).singleElement().satisfies(v -> {
            assertThat(v.route()).isEqualTo("2");
            assertThat(v.routeName()).isEqualTo("2");
            assertThat(v.type()).isEqualTo("TRAM");
            assertThat(v.color()).isEqualTo("#e3a900");
        });
        verify(stpt, never()).fetchAllVehicles();
    }

    // Without a route: one STPT call for every line, route null, each vehicle tagged with its line.
    @Test
    void allVehiclesWithoutRoute() {
        when(stpt.fetchAllVehicles()).thenReturn(List.of(
                new StptVehicle("1010", 45.7, 21.2, 10.0, 5.0, "2", "Shopping City", "X", 1L, true),
                new StptVehicle("B1", 45.7, 21.2, null, null, "m14", "A", "Y", 2L, false),
                new StptVehicle("B2", 45.7, 21.2, null, null, "99", "Z", "Y", 2L, false)));

        VehiclesResponse r = service.vehicles(null);

        assertThat(r.route()).isNull();
        assertThat(r.stale()).isFalse();
        assertThat(r.vehicles()).extracting(VehicleDto::route).containsExactly("2", "M14", "99");
        assertThat(r.vehicles()).extracting(VehicleDto::type).containsExactly("TRAM", "TROLLEYBUS", null);
        assertThat(r.vehicles()).extracting(VehicleDto::color).containsExactly("#e3a900", "#6f2095", null);
        assertThat(service.vehicles(" ").vehicles()).hasSize(3);
        verify(stpt, never()).fetchVehicles(anyString());
    }

    // The all-vehicles answer is shared for the vehicles TTL (10 s), then fetched again.
    @Test
    void allVehiclesCached() {
        when(stpt.fetchAllVehicles()).thenReturn(List.of());
        service.vehicles(null);
        clock.advance(Duration.ofSeconds(5));
        service.vehicles(null);
        verify(stpt, times(1)).fetchAllVehicles();
        clock.advance(Duration.ofSeconds(6));
        service.vehicles(null);
        verify(stpt, times(2)).fetchAllVehicles();
    }

    // STPT down after a success: last vehicles of every line come back stale.
    @Test
    void allVehiclesStaleWhenSourceDown() {
        when(stpt.fetchAllVehicles()).thenReturn(List.of(
                new StptVehicle("1010", 45.7, 21.2, 10.0, 5.0, "2", "Shopping City", "X", 1L, true)));
        service.vehicles(null);
        clock.advance(Duration.ofSeconds(30));
        when(stpt.fetchAllVehicles()).thenThrow(new IllegalStateException("timeout"));

        VehiclesResponse r = service.vehicles(null);

        assertThat(r.stale()).isTrue();
        assertThat(r.updatedAt()).isEqualTo(NOW);
        assertThat(r.vehicles()).hasSize(1);
    }

    // STPT's line list down: vehicles still come back, without type and colour.
    @Test
    void vehiclesWithoutLineList() {
        when(stpt.fetchRoutes()).thenThrow(new IllegalStateException("timeout"));
        when(stpt.fetchAllVehicles()).thenReturn(List.of(
                new StptVehicle("1010", 45.7, 21.2, 10.0, 5.0, "2", "Shopping City", "X", 1L, true)));
        assertThat(service.vehicles(null).vehicles()).singleElement().satisfies(v -> {
            assertThat(v.route()).isEqualTo("2");
            assertThat(v.type()).isNull();
        });
    }

    // STPT down after a success: last vehicles come back with stale=true (PLAN 9.7).
    @Test
    void vehiclesStaleWhenSourceDown() {
        when(stpt.fetchVehicles("1")).thenReturn(List.of(
                new StptVehicle("1010", 45.7, 21.2, 10.0, 5.0, "1", "Gara de Nord", "X", 1L, true)));
        service.vehicles("1");
        clock.advance(Duration.ofSeconds(30));
        when(stpt.fetchVehicles("1")).thenThrow(new IllegalStateException("timeout"));

        VehiclesResponse r = service.vehicles("1");

        assertThat(r.stale()).isTrue();
        assertThat(r.updatedAt()).isEqualTo(NOW);
        assertThat(r.vehicles()).hasSize(1);
    }

    // STPT down and nothing cached: 503.
    @Test
    void vehiclesUnavailableWithoutCache() {
        when(stpt.fetchVehicles("1")).thenThrow(new IllegalStateException("timeout"));
        assertThatThrownBy(() -> service.vehicles("1"))
                .isInstanceOf(ApiException.class)
                .extracting(e -> ((ApiException) e).code()).isEqualTo(ErrorCode.SOURCE_UNAVAILABLE);
    }

    // Shapes take STPT's line type/colour, are sorted like the routes list and can be filtered.
    @Test
    void shapesSortedAndFiltered() {
        when(shapeRepository.shapes()).thenReturn(List.of(
                shape("13", "3", null), shape("M14", "11", "6f2095"), shape("2", "0", "e3a900")));

        List<TransitShapeDto> shapes = service.shapes(null);

        assertThat(shapes).extracting(TransitShapeDto::route).containsExactly("2", "M14", "13");
        assertThat(shapes.get(1).type()).isEqualTo("TROLLEYBUS");
        assertThat(shapes.get(1).color()).isEqualTo("#6f2095");
        assertThat(shapes.get(0).polylines()).hasSize(1);
        assertThat(service.shapes("m14")).extracting(TransitShapeDto::route).containsExactly("M14");
        assertThat(service.shapes("nope")).isEmpty();
    }

    // Shapes are built once and kept in memory.
    @Test
    void shapesCached() {
        when(shapeRepository.shapes()).thenReturn(List.of(shape("2", "0", "e3a900")));
        service.shapes(null);
        service.shapes("2");
        clock.advance(Duration.ofDays(2));
        service.shapes(null);
        verify(shapeRepository, times(1)).shapes();
    }

    // Line list down: GTFS type/colour are used; that build is reused for a few minutes, then rebuilt with STPT.
    @Test
    void shapesWithoutLineListUseGtfs() {
        when(stpt.fetchRoutes()).thenThrow(new IllegalStateException("timeout"));
        when(shapeRepository.shapes()).thenReturn(List.of(shape("E4b", "3", null)));

        assertThat(service.shapes(null)).singleElement().satisfies(s -> {
            assertThat(s.type()).isEqualTo("BUS");
            assertThat(s.color()).isNull();
        });
        service.shapes(null);
        service.shapes("e4b");
        verify(shapeRepository, times(1)).shapes();
        verify(stpt, times(1)).fetchRoutes();

        // STPT is back after the fallback window: the shapes get STPT's type and are cached for good.
        org.mockito.Mockito.reset(stpt);
        when(stpt.fetchRoutes()).thenReturn(List.of(new StptRoute("E4b", "C - D", "3", "express", null)));
        clock.advance(TransitServiceImpl.FALLBACK_SHAPES_TTL.plusSeconds(1));
        assertThat(service.shapes(null)).singleElement().satisfies(s -> assertThat(s.type()).isEqualTo("EXPRESS"));
        service.shapes(null);
        verify(shapeRepository, times(2)).shapes();
    }

    // Line list down and nothing cached: vehicle polls do not ask STPT for it again until the retry window ends.
    @Test
    void vehiclesDoNotRetryFailedLineListAtOnce() {
        when(stpt.fetchRoutes()).thenThrow(new IllegalStateException("timeout"));
        when(stpt.fetchAllVehicles()).thenReturn(List.of(
                new StptVehicle("1010", 45.7, 21.2, 10.0, 5.0, "2", "Shopping City", "X", 1L, true)));

        service.vehicles(null);
        clock.advance(Duration.ofSeconds(11)); // vehicles cache expired, line-list retry window not yet
        service.vehicles(null);
        verify(stpt, times(1)).fetchRoutes();

        clock.advance(TransitServiceImpl.ROUTES_RETRY_AFTER);
        service.vehicles(null);
        verify(stpt, times(2)).fetchRoutes();
    }

    // A line without a short name is skipped instead of breaking routes, vehicles and shapes.
    @Test
    void lineWithoutNameIsSkipped() {
        when(stpt.fetchRoutes()).thenReturn(List.of(
                new StptRoute(null, "A - B", "3", "urban", null),
                new StptRoute("2", "C - D", "0", "tram", "e3a900")));
        when(stpt.fetchAllVehicles()).thenReturn(List.of(
                new StptVehicle("1010", 45.7, 21.2, 10.0, 5.0, "2", "Shopping City", "X", 1L, true)));
        when(shapeRepository.shapes()).thenReturn(List.of(shape("2", "0", "e3a900")));

        assertThat(service.routes()).extracting(TransitRouteDto::id).containsExactly("2");
        assertThat(service.vehicles(null).vehicles()).singleElement()
                .satisfies(v -> assertThat(v.type()).isEqualTo("TRAM"));
        assertThat(service.shapes(null)).singleElement().satisfies(s -> assertThat(s.type()).isEqualTo("TRAM"));
    }

    // A vehicle STPT reports without a line keeps route null (documented) and gets no type.
    @Test
    void vehicleWithoutRoute() {
        when(stpt.fetchAllVehicles()).thenReturn(List.of(
                new StptVehicle("X1", 45.7, 21.2, null, null, null, null, null, 1L, null)));
        assertThat(service.vehicles(null).vehicles()).singleElement().satisfies(v -> {
            assertThat(v.route()).isNull();
            assertThat(v.type()).isNull();
        });
    }

    // No timetable file: no shapes.
    @Test
    void noShapesWithoutFile() {
        when(shapeRepository.shapes()).thenReturn(List.of());
        assertThat(service.shapes(null)).isEmpty();
    }

    // A two-point shape for a line.
    private static RouteShape shape(String name, String type, String color) {
        return new RouteShape(name, type, color,
                List.of(List.of(new GeoPoint(45.70, 21.20), new GeoPoint(45.71, 21.21))));
    }

    // Arrivals from all lines are merged and sorted, duplicates dropped, stop name filled in.
    @Test
    void arrivalsMergedAndSorted() {
        ArrivalsResponse r = service.arrivals("1");
        assertThat(r.stopName()).isEqualTo("Dâmbovița (Ion Barac)");
        assertThat(r.stale()).isFalse();
        assertThat(r.arrivals()).extracting(a -> a.route() + "@" + a.minutes())
                .containsExactly("9@5", "2@10", "9@22", "2@25", "9@36");
        assertThat(r.arrivals().get(1).live()).isTrue();
    }

    // Unknown stop is 404 and STPT is not asked for its arrivals.
    @Test
    void arrivalsUnknownStop() {
        assertThatThrownBy(() -> service.arrivals("999999"))
                .isInstanceOf(ApiException.class)
                .extracting(e -> ((ApiException) e).code()).isEqualTo(ErrorCode.NOT_FOUND);
        verify(stpt, times(0)).fetchArrivals("999999");
    }

    // Stop list unavailable: arrivals still answer, without a stop name.
    @Test
    void arrivalsWithoutStopList() {
        when(stpt.fetchStops()).thenThrow(new IllegalStateException("down"));
        assertThat(service.arrivals("1").stopName()).isNull();
    }

    // Latest known time per line and direction, marked LIVE_ESTIMATE until GTFS exists.
    @Test
    void lastDeparturesFromLiveData() {
        LastDeparturesResponse r = service.lastDepartures("1");
        assertThat(r.source()).isEqualTo("LIVE_ESTIMATE");
        assertThat(r.departures()).containsExactly(
                new LastDepartureDto("2", "Shopping City", Instant.parse("2026-11-13T19:00:00Z")),
                new LastDepartureDto("9", "Piața Gh. Domășneanu", Instant.parse("2026-11-13T19:10:00Z")));
    }

    // Nearest stop to Piața Victoriei in our small network, English sentence for the earliest line.
    @Test
    void summaryInEnglish() {
        when(stpt.fetchArrivals("1000")).thenReturn(List.of(
                new StptArrival("2", "tv", "Shopping City", null, List.of("21:41|66"))));
        TransitSummaryResponse r = service.summary(new GeoPoint(45.7537, 21.2257), Locale.ENGLISH);

        assertThat(r.nearestStop().id()).isEqualTo("1000");
        assertThat(r.nearestStop().distanceMeters()).isBetween(500, 1000);
        assertThat(r.activeAlerts()).isEqualTo(1);
        assertThat(r.nextArrival().route()).isEqualTo("2");
        assertThat(r.nextArrival().last()).isFalse(); // live estimate alone never claims "last"
        assertThat(r.message()).isEqualTo("Next tram 2 at City of Mara (Lidl) arrives at 21:41 (in 66 min)");
    }

    // Romanian sentence; alerts down counts as 0 instead of failing the summary.
    @Test
    void summaryInRomanianWithAlertsDown() {
        when(stpt.fetchAlerts()).thenThrow(new IllegalStateException("down"));
        TransitSummaryResponse r = service.summary(new GeoPoint(45.7401, 21.1961), Locale.of("ro"));

        assertThat(r.nearestStop().id()).isEqualTo("1");
        assertThat(r.activeAlerts()).isZero();
        assertThat(r.message()).isEqualTo("Următorul tramvai 9 în stația Dâmbovița (Ion Barac) sosește la 20:40 (în 5 min)");
    }

    // No arrivals known: a clear sentence instead of an error.
    @Test
    void summaryWithoutDepartures() {
        when(stpt.fetchArrivals("1000")).thenReturn(List.of());
        TransitSummaryResponse r = service.summary(new GeoPoint(45.7537, 21.2257), Locale.ENGLISH);
        assertThat(r.lastDepartures()).isEmpty();
        assertThat(r.nextArrival()).isNull();
        assertThat(r.message()).isEqualTo("No departures known from City of Mara (Lidl) right now.");
    }

    // With a timetable covering today: real last departures (23:46 local = 21:46 UTC), source TIMETABLE,
    // and STPT's arrivals are not needed.
    @Test
    void lastDeparturesFromTimetable() {
        when(timetable.lastDepartures("1", LocalDate.of(2026, 11, 13))).thenReturn(Optional.of(List.of(
                new ScheduledDeparture("9", "Piața Gh. Domășneanu", 22 * 3600 + 52 * 60),
                new ScheduledDeparture("2", "Shopping City", 23 * 3600 + 46 * 60))));

        LastDeparturesResponse r = service.lastDepartures("1");

        assertThat(r.source()).isEqualTo("TIMETABLE");
        assertThat(r.stopName()).isEqualTo("Dâmbovița (Ion Barac)");
        assertThat(r.departures()).containsExactly(
                new LastDepartureDto("2", "Shopping City", Instant.parse("2026-11-13T21:46:00Z")),
                new LastDepartureDto("9", "Piața Gh. Domășneanu", Instant.parse("2026-11-13T20:52:00Z")));
        verify(stpt, times(0)).fetchArrivals("1");
    }

    // Times past 24:00 belong to the same service day (00:30 the next calendar day).
    @Test
    void timetableTimesAfterMidnight() {
        when(timetable.lastDepartures("1", LocalDate.of(2026, 11, 13))).thenReturn(Optional.of(List.of(
                new ScheduledDeparture("2", "Shopping City", 24 * 3600 + 30 * 60))));
        assertThat(service.lastDepartures("1").departures().get(0).lastDepartureAt())
                .isEqualTo(Instant.parse("2026-11-13T22:30:00Z"));
    }

    // Before 03:00 local time the previous day's timetable still applies.
    @Test
    void serviceDayStartsAtThree() {
        assertThat(TransitServiceImpl.serviceDate(Instant.parse("2026-11-13T23:30:00Z"))) // 01:30 on the 14th
                .isEqualTo(LocalDate.of(2026, 11, 13));
        assertThat(TransitServiceImpl.serviceDate(Instant.parse("2026-11-14T01:00:00Z"))) // 03:00 on the 14th
                .isEqualTo(LocalDate.of(2026, 11, 14));
    }

    // Timetable empty for this stop today: live estimate as before.
    @Test
    void emptyTimetableFallsBackToLive() {
        when(timetable.lastDepartures(org.mockito.ArgumentMatchers.eq("1"), org.mockito.ArgumentMatchers.any()))
                .thenReturn(Optional.of(List.of()));
        assertThat(service.lastDepartures("1").source()).isEqualTo("LIVE_ESTIMATE");
    }

    // A stop STPT's live list does not know, but the timetable does, still answers.
    @Test
    void stopKnownOnlyToTimetable() {
        when(timetable.lastDepartures(org.mockito.ArgumentMatchers.eq("555"), org.mockito.ArgumentMatchers.any()))
                .thenReturn(Optional.of(List.of(new ScheduledDeparture("33", "Bucovina", 22 * 3600))));
        when(timetable.stopName("555")).thenReturn(Optional.of("Gara de Nord"));
        assertThat(service.lastDepartures("555").stopName()).isEqualTo("Gara de Nord");
    }

    // Summary from the timetable over an evening: next arrival at the nearest stop, then "last one today", then nothing.
    @Test
    void summaryFromTimetable() {
        when(timetable.lastDepartures("1", LocalDate.of(2026, 11, 13))).thenReturn(Optional.of(List.of(
                new ScheduledDeparture("9", "Piața Gh. Domășneanu", 22 * 3600 + 52 * 60),
                new ScheduledDeparture("2", "Shopping City", 23 * 3600 + 46 * 60))));
        GeoPoint here = new GeoPoint(45.7401, 21.1961);

        TransitSummaryResponse r = service.summary(here, Locale.ENGLISH);
        assertThat(r.nextArrival().route()).isEqualTo("9");
        assertThat(r.nextArrival().last()).isFalse();
        assertThat(r.message()).isEqualTo("Next tram 9 at Dâmbovița (Ion Barac) arrives at 20:40 (in 5 min)");

        clock.advance(Duration.ofMinutes(135)); // 22:50 local: tram 9's last trip is 2 min away
        when(stpt.fetchArrivals("1")).thenReturn(List.of(
                new StptArrival("9", "tv", "Piața Gh. Domășneanu", "1040", List.of("22:52|2")),
                new StptArrival("2", "tv", "Shopping City", null, List.of("23:10|20"))));
        r = service.summary(here, Locale.ENGLISH);
        assertThat(r.nextArrival().last()).isTrue();
        assertThat(r.message()).isEqualTo(
                "Last tram 9 at Dâmbovița (Ion Barac) arrives at 22:52 (in 2 min). It's the last one today.");
        assertThat(service.summary(here, Locale.of("ro")).message()).isEqualTo(
                "Ultimul tramvai 9 în stația Dâmbovița (Ion Barac) sosește la 22:52 (în 2 min). E ultimul de azi.");

        clock.advance(Duration.ofMinutes(65)); // 23:55 local: everything has gone
        when(stpt.fetchArrivals("1")).thenReturn(List.of());
        r = service.summary(here, Locale.of("ro"));
        assertThat(r.nextArrival()).isNull();
        assertThat(r.message()).isEqualTo("Nu mai sunt plecări din Dâmbovița (Ion Barac) în seara asta.");
    }

    // STPT arrivals down but the timetable works: falls back to the last-departure sentence.
    @Test
    void summaryFallsBackToLastDepartureWhenArrivalsDown() {
        when(timetable.lastDepartures("1", LocalDate.of(2026, 11, 13))).thenReturn(Optional.of(List.of(
                new ScheduledDeparture("9", "Piața Gh. Domășneanu", 22 * 3600 + 52 * 60),
                new ScheduledDeparture("2", "Shopping City", 23 * 3600 + 46 * 60))));
        when(stpt.fetchArrivals("1")).thenThrow(new IllegalStateException("down"));
        TransitSummaryResponse r = service.summary(new GeoPoint(45.7401, 21.1961), Locale.ENGLISH);
        assertThat(r.nextArrival()).isNull();
        assertThat(r.message()).isEqualTo("Last tram 9 from Dâmbovița (Ion Barac) leaves at 22:52");
    }

    // Last-trip check: same direction when the names match, otherwise the line's latest trip; small tolerance.
    @Test
    void lastTripDetection() {
        LastDeparturesResponse timetableLast = new LastDeparturesResponse("1", "X", "TIMETABLE", List.of(
                new LastDepartureDto("9", "Piața Gh. Domășneanu", Instant.parse("2026-11-13T20:52:00Z")),
                new LastDepartureDto("9", "Calea Șagului", Instant.parse("2026-11-13T21:30:00Z"))));
        java.util.function.Function<String, com.unihack8.backend.transit.domain.dto.ArrivalDto> at = (time) ->
                new com.unihack8.backend.transit.domain.dto.ArrivalDto("9", "Piața Gh. Domășneanu",
                        Instant.parse(time), 1, true);
        assertThat(TransitServiceImpl.isLastTrip(at.apply("2026-11-13T20:50:00Z"), timetableLast)).isTrue();
        assertThat(TransitServiceImpl.isLastTrip(at.apply("2026-11-13T20:30:00Z"), timetableLast)).isFalse();
        assertThat(TransitServiceImpl.isLastTrip(
                new com.unihack8.backend.transit.domain.dto.ArrivalDto("9", "Unknown name",
                        Instant.parse("2026-11-13T20:52:00Z"), 1, true), timetableLast)).isFalse();
        assertThat(TransitServiceImpl.isLastTrip(at.apply("2026-11-13T20:52:00Z"),
                new LastDeparturesResponse("1", "X", "LIVE_ESTIMATE", timetableLast.departures()))).isFalse();
    }

    // Line names sort like people expect.
    @Test
    void lineNameOrder() {
        List<String> names = new java.util.ArrayList<>(List.of("E4b", "11", "2", "M14", "E4", "5b", "5c", "S10"));
        names.sort(TransitServiceImpl::compareLineNames);
        assertThat(names).containsExactly("2", "5b", "5c", "11", "E4", "E4b", "M14", "S10");
    }

    // Vehicle nouns in both languages, with a fallback for unknown lines.
    @Test
    void vehicleWords() {
        assertThat(TransitServiceImpl.vehicleWord("TROLLEYBUS", false)).isEqualTo("trolleybus");
        assertThat(TransitServiceImpl.vehicleWord("EXPRESS", true)).isEqualTo("autobuz");
        assertThat(TransitServiceImpl.vehicleWord(null, false)).isEqualTo("service");
    }
}
