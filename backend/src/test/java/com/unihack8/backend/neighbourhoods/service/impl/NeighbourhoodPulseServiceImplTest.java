package com.unihack8.backend.neighbourhoods.service.impl;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.unihack8.backend.common.dto.PageResponse;
import com.unihack8.backend.common.exception.ApiException;
import com.unihack8.backend.common.exception.ErrorCode;
import com.unihack8.backend.common.geo.GeoPoint;
import com.unihack8.backend.events.domain.dto.EventSummary;
import com.unihack8.backend.events.domain.dto.ParticipantResponse;
import com.unihack8.backend.events.domain.dto.UserSummary;
import com.unihack8.backend.events.service.EventService;
import com.unihack8.backend.neighbourhoods.domain.dto.NeighbourhoodPulseDto;
import com.unihack8.backend.neighbourhoods.domain.dto.NeighbourhoodPulseResponse;
import com.unihack8.backend.neighbourhoods.domain.dto.PulseEventDto;
import com.unihack8.backend.neighbourhoods.domain.model.Neighbourhood;
import com.unihack8.backend.neighbourhoods.mapper.impl.NeighbourhoodPulseMapperImpl;
import com.unihack8.backend.places.domain.dto.PlaceDetailDto;
import com.unihack8.backend.places.domain.dto.PlaceExploreCriteria;
import com.unihack8.backend.places.domain.dto.PlaceInsightDto;
import com.unihack8.backend.places.service.PlaceService;
import com.unihack8.backend.support.MutableClock;
import com.unihack8.backend.transit.domain.dto.AlertDto;
import com.unihack8.backend.transit.domain.dto.TransitRouteDto;
import com.unihack8.backend.transit.domain.dto.TransitStopDto;
import com.unihack8.backend.transit.domain.dto.VehicleDto;
import com.unihack8.backend.transit.domain.dto.VehiclesResponse;
import com.unihack8.backend.transit.service.TransitService;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

/** Neighbourhood Pulse built from mocked events, places and transit. */
class NeighbourhoodPulseServiceImplTest {

    // 18:00 UTC = 20:00 in Timișoara.
    private static final Instant NOW = Instant.parse("2026-11-14T18:00:00Z");
    private static final Neighbourhood A = new Neighbourhood("a", "Alpha", new GeoPoint(45.75, 21.20), 1000);
    private static final Neighbourhood B = new Neighbourhood("b", "Beta", new GeoPoint(45.80, 21.30), 1000);
    private static final UUID U1 = UUID.randomUUID();
    private static final UUID U2 = UUID.randomUUID();
    private static final UUID U3 = UUID.randomUUID();

    private final EventService events = mock(EventService.class);
    private final PlaceService places = mock(PlaceService.class);
    private final TransitService transit = mock(TransitService.class);
    private MutableClock clock;
    private NeighbourhoodPulseServiceImpl service;

    private EventSummary running;
    private EventSummary noEnd;
    private EventSummary tonight;

    // Helper: an event at a position.
    private static EventSummary event(String source, double lat, double lon, String start, String end,
                                      Integer capacity, Integer spotsLeft) {
        return new EventSummary(UUID.randomUUID(), source, "Event " + start, "PARTY", "Venue", lat, lon,
                Instant.parse(start), end == null ? null : Instant.parse(end), null, null, null,
                capacity, spotsLeft, null, 0);
    }

    // Helper: a place with opening hours.
    private static PlaceInsightDto place(String category, double lat, double lon, String hours) {
        return new PlaceInsightDto(new PlaceDetailDto(UUID.randomUUID(), "node/1", "P", category, lat, lon,
                null, hours, Map.of()), 0, List.of());
    }

    // Helper: a participant.
    private static ParticipantResponse participant(UUID id, int score, String status) {
        return new ParticipantResponse(new UserSummary(id, "u" + score, score), status, NOW);
    }

    // Mocks every source with data for area A and a little for area B.
    @BeforeEach
    void setUp() {
        clock = new MutableClock(NOW);
        service = new NeighbourhoodPulseServiceImpl(events, places, transit, new NeighbourhoodPulseMapperImpl(),
                clock, List.of(A, B));

        running = event("USER", 45.751, 21.201, "2026-11-14T17:00:00Z", "2026-11-14T20:00:00Z", 10, 4);
        noEnd = event("USER", 45.749, 21.199, "2026-11-14T16:00:00Z", null, null, null);
        tonight = event("EXTERNAL", 45.750, 21.202, "2026-11-14T20:00:00Z", null, null, null);
        EventSummary over = event("USER", 45.750, 21.200, "2026-11-14T06:00:00Z", "2026-11-14T08:00:00Z", 5, 5);
        EventSummary elsewhere = event("USER", 44.0, 26.0, "2026-11-14T17:30:00Z", null, 5, 5);
        when(events.search(isNull(), isNull(), any(), any(), any(), isNull(), eq(0), anyInt()))
                .thenReturn(new PageResponse<>(List.of(running, noEnd, tonight, over, elsewhere), 0, 500, 5, 1));
        when(events.participants(running.id())).thenReturn(List.of(
                participant(U1, 120, "JOINED"), participant(U2, 80, "ATTENDED"), participant(U3, 150, "BANNED")));
        when(events.participants(noEnd.id())).thenReturn(List.of(participant(U1, 120, "JOINED")));

        when(places.explore(any(PlaceExploreCriteria.class))).thenAnswer(call -> {
            PlaceExploreCriteria criteria = call.getArgument(0);
            if (criteria.near().equals(A.centre())) {
                return List.of(place("restaurant", 45.751, 21.200, "24/7"),
                        place("cafe", 45.752, 21.200, "Mo-Su 08:00-10:00"),
                        place("bar", 45.80, 21.30, "24/7")); // belongs to B
            }
            return List.of();
        });

        when(transit.stops(null)).thenReturn(List.of(
                new TransitStopDto("s1", "Piața Alpha", 45.750, 21.200, List.of("r1")),
                new TransitStopDto("s2", "Alpha Nord", 45.752, 21.201, List.of("r2", "r1"))));
        when(transit.routes()).thenReturn(List.of(
                new TransitRouteDto("r1", "TRAM", "1", "x", "y", "#fff"),
                new TransitRouteDto("r2", "EXPRESS", "E2", "x", "y", "#000")));
        when(transit.vehicles(null)).thenReturn(new VehiclesResponse(null, NOW, false, List.of(
                vehicle(45.750, 21.200), vehicle(45.751, 21.201), vehicle(45.800, 21.300))));
        when(transit.alerts()).thenReturn(List.of(
                new AlertDto("al1", "Info", "Linia 1 circulă deviat"),
                new AlertDto("al2", "Info", "Linia 99 nu circulă")));
    }

    // Helper: a live vehicle at a position.
    private static VehicleDto vehicle(double lat, double lon) {
        return new VehicleDto(UUID.randomUUID().toString(), "r1", "1", "TRAM", "#fff", lat, lon,
                null, null, null, null, null, NOW);
    }

    // Every section of the busy area is filled from the right sources.
    @Test
    void buildsAreaCards() {
        NeighbourhoodPulseResponse answer = service.pulse();

        assertThat(answer.generatedAt()).isEqualTo(NOW);
        assertThat(answer.areas()).extracting(NeighbourhoodPulseDto::id).containsExactly("a", "b");
        NeighbourhoodPulseDto a = answer.areas().get(0);

        assertThat(a.events().nowCount()).isEqualTo(2);
        assertThat(a.events().tonightCount()).isEqualTo(1);
        assertThat(a.events().freeSpots()).isEqualTo(4);
        assertThat(a.events().highlights()).extracting(PulseEventDto::id)
                .containsExactly(noEnd.id(), running.id(), tonight.id());
        assertThat(a.events().highlights()).extracting(PulseEventDto::happeningNow)
                .containsExactly(true, true, false);

        assertThat(a.people().going()).isEqualTo(2);
        assertThat(a.people().reliableGoing()).isEqualTo(1);

        assertThat(a.places().total()).isEqualTo(2);
        assertThat(a.places().openNow()).isEqualTo(1);
        assertThat(a.places().topCategories()).containsExactly("restaurant");

        assertThat(a.transit().available()).isTrue();
        assertThat(a.transit().lines()).containsExactly("1", "E2");
        assertThat(a.transit().stopCount()).isEqualTo(2);
        assertThat(a.transit().liveVehicles()).isEqualTo(2);
        assertThat(a.transit().alerts()).extracting(AlertDto::id).containsExactly("al1");

        // 2 now × 4 + 1 tonight × 2 + 2 people + 0 (1 open place / 5) + 2 vehicles = 14
        assertThat(a.score()).isEqualTo(14);
        assertThat(a.level()).isEqualTo("STEADY");

        NeighbourhoodPulseDto b = answer.areas().get(1);
        assertThat(b.events().nowCount()).isZero();
        assertThat(b.transit().liveVehicles()).isEqualTo(1);
        assertThat(b.transit().lines()).isEmpty();
        assertThat(b.level()).isEqualTo("QUIET");
    }

    // STPT down: transit sections say unavailable, everything else still answers.
    @Test
    void transitDownOnlyEmptiesTransit() {
        when(transit.stops(null)).thenThrow(new ApiException(ErrorCode.SOURCE_UNAVAILABLE, "down"));

        NeighbourhoodPulseDto a = service.pulse().areas().get(0);

        assertThat(a.transit().available()).isFalse();
        assertThat(a.transit().lines()).isEmpty();
        assertThat(a.events().nowCount()).isEqualTo(2);
        assertThat(a.places().openNow()).isEqualTo(1);
    }

    // Vehicles or alerts failing alone keeps the lines.
    @Test
    void vehiclesDownKeepsLines() {
        when(transit.vehicles(null)).thenThrow(new ApiException(ErrorCode.SOURCE_UNAVAILABLE, "down"));
        when(transit.alerts()).thenThrow(new ApiException(ErrorCode.SOURCE_UNAVAILABLE, "down"));

        NeighbourhoodPulseDto a = service.pulse().areas().get(0);

        assertThat(a.transit().available()).isTrue();
        assertThat(a.transit().lines()).containsExactly("1", "E2");
        assertThat(a.transit().liveVehicles()).isZero();
        assertThat(a.transit().alerts()).isEmpty();
    }

    // Events failing gives empty event and people sections.
    @Test
    void eventsDown() {
        when(events.search(any(), any(), any(), any(), any(), any(), any(), any()))
                .thenThrow(new RuntimeException("db down"));

        NeighbourhoodPulseDto a = service.pulse().areas().get(0);

        assertThat(a.events().nowCount()).isZero();
        assertThat(a.events().highlights()).isEmpty();
        assertThat(a.people().going()).isZero();
        assertThat(a.transit().liveVehicles()).isEqualTo(2);
    }

    // The answer is reused for 30 seconds, then rebuilt.
    @Test
    void cachesForThirtySeconds() {
        service.pulse();
        clock.advance(Duration.ofSeconds(20));
        service.pulse();
        verify(events, times(1)).search(any(), any(), any(), any(), any(), any(), any(), any());

        clock.advance(Duration.ofSeconds(11));
        assertThat(service.pulse().generatedAt()).isEqualTo(NOW.plusSeconds(31));
        verify(events, times(2)).search(any(), any(), any(), any(), any(), any(), any(), any());
    }

    // Levels and the end of "tonight".
    @Test
    void levelsAndTonight() {
        assertThat(NeighbourhoodPulseServiceImpl.level(0)).isEqualTo("QUIET");
        assertThat(NeighbourhoodPulseServiceImpl.level(5)).isEqualTo("STEADY");
        assertThat(NeighbourhoodPulseServiceImpl.level(15)).isEqualTo("BUSY");
        // 20:00 local -> 05:00 local next day (03:00 UTC in November).
        assertThat(NeighbourhoodPulseServiceImpl.tonightEnds(NOW)).isEqualTo(Instant.parse("2026-11-15T03:00:00Z"));
        // 02:00 local -> 05:00 local the same morning.
        assertThat(NeighbourhoodPulseServiceImpl.tonightEnds(Instant.parse("2026-11-15T00:00:00Z")))
                .isEqualTo(Instant.parse("2026-11-15T03:00:00Z"));
    }
}
