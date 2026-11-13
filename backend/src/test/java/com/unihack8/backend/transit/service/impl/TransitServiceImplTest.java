package com.unihack8.backend.transit.service.impl;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
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
import com.unihack8.backend.transit.domain.dto.TransitSummaryResponse;
import com.unihack8.backend.transit.domain.dto.VehiclesResponse;
import com.unihack8.backend.transit.domain.dto.stpt.StptAlert;
import com.unihack8.backend.transit.domain.dto.stpt.StptArrival;
import com.unihack8.backend.transit.domain.dto.stpt.StptRoute;
import com.unihack8.backend.transit.domain.dto.stpt.StptStop;
import com.unihack8.backend.transit.domain.dto.stpt.StptVehicle;
import com.unihack8.backend.transit.mapper.impl.TransitMapperImpl;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

/** Transit service logic with a fake STPT and a controllable clock (PLAN 9.2–9.7). */
class TransitServiceImplTest {

    // 20:35 in Timișoara.
    private static final Instant NOW = Instant.parse("2026-11-13T18:35:00Z");

    private final StptClient stpt = mock(StptClient.class);
    private final MutableClock clock = new MutableClock(NOW);
    private TransitServiceImpl service;

    // Fresh service (empty caches) and a small STPT network for every test.
    @BeforeEach
    void setUp() {
        StptProperties props = new StptProperties("https://live.stpt.test", Duration.ofSeconds(3),
                Duration.ofSeconds(5), "test", new StptProperties.Ttl(Duration.ofSeconds(10),
                Duration.ofSeconds(20), Duration.ofMinutes(5), Duration.ofHours(24)));
        service = new TransitServiceImpl(stpt, new TransitMapperImpl(), clock, props);

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
        assertThat(service.stops(BoundingBox.parseOptional("21.19,45.735,21.20,45.745")))
                .singleElement().satisfies(s -> assertThat(s.id()).isEqualTo("1"));
    }

    // Vehicles carry the fetch time and are not stale on success.
    @Test
    void vehiclesFresh() {
        when(stpt.fetchVehicles("1")).thenReturn(List.of(
                new StptVehicle("1010", 45.7, 21.2, 10.0, 5.0, "1", "Gara de Nord", "X", 1L, true)));
        VehiclesResponse r = service.vehicles(" 1 ");
        assertThat(r.route()).isEqualTo("1");
        assertThat(r.stale()).isFalse();
        assertThat(r.updatedAt()).isEqualTo(NOW);
        assertThat(r.vehicles()).hasSize(1);
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

    // Blank route is a validation error.
    @Test
    void vehiclesNeedRoute() {
        assertThatThrownBy(() -> service.vehicles(" "))
                .isInstanceOf(ApiException.class)
                .extracting(e -> ((ApiException) e).code()).isEqualTo(ErrorCode.VALIDATION_FAILED);
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
        assertThat(r.message()).isEqualTo("Last tram 2 from City of Mara (Lidl) leaves at 21:41");
    }

    // Romanian sentence; alerts down counts as 0 instead of failing the summary.
    @Test
    void summaryInRomanianWithAlertsDown() {
        when(stpt.fetchAlerts()).thenThrow(new IllegalStateException("down"));
        TransitSummaryResponse r = service.summary(new GeoPoint(45.7401, 21.1961), Locale.of("ro"));

        assertThat(r.nearestStop().id()).isEqualTo("1");
        assertThat(r.activeAlerts()).isZero();
        assertThat(r.message()).isEqualTo("Ultimul tramvai 2 din Dâmbovița (Ion Barac) pleacă la 21:00");
    }

    // No arrivals known: a clear sentence instead of an error.
    @Test
    void summaryWithoutDepartures() {
        when(stpt.fetchArrivals("1000")).thenReturn(List.of());
        TransitSummaryResponse r = service.summary(new GeoPoint(45.7537, 21.2257), Locale.ENGLISH);
        assertThat(r.lastDepartures()).isEmpty();
        assertThat(r.message()).isEqualTo("No departures known from City of Mara (Lidl) right now.");
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
