package com.unihack8.backend.ai.tool.impl;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.unihack8.backend.ai.domain.ToolContext;
import com.unihack8.backend.ai.tool.ToolException;
import com.unihack8.backend.common.exception.ApiException;
import com.unihack8.backend.common.exception.ErrorCode;
import com.unihack8.backend.common.geo.GeoPoint;
import com.unihack8.backend.transit.domain.dto.AlertDto;
import com.unihack8.backend.transit.domain.dto.ArrivalDto;
import com.unihack8.backend.transit.domain.dto.ArrivalsResponse;
import com.unihack8.backend.transit.domain.dto.LastDepartureDto;
import com.unihack8.backend.transit.domain.dto.LastDeparturesResponse;
import com.unihack8.backend.transit.domain.dto.TransitRouteDto;
import com.unihack8.backend.transit.domain.dto.TransitStopDto;
import com.unihack8.backend.transit.service.TransitService;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

/** transit_info: nearest stops, vehicle types, local times, STPT down. */
class TransitInfoToolTest {

    private static final Instant NOW = Instant.parse("2026-11-14T20:00:00Z");
    private static final GeoPoint USER = new GeoPoint(45.7537, 21.2257);

    private final TransitService transit = mock(TransitService.class);
    private final TransitInfoTool tool = new TransitInfoTool(transit);

    // "Last tram": only stops and departures of TRAM lines; times in Romanian local time.
    @Test
    @SuppressWarnings("unchecked")
    void lastTram() {
        when(transit.stops(null)).thenReturn(List.of(
                new TransitStopDto("10", "Trolley Stop", 45.7538, 21.2258, List.of("16")),
                new TransitStopDto("20", "Catedrala", 45.7510, 21.2240, List.of("2", "16"))));
        when(transit.routes()).thenReturn(List.of(
                new TransitRouteDto("2", "TRAM", "2", null, null, null),
                new TransitRouteDto("16", "TROLLEYBUS", "16", null, null, null)));
        when(transit.arrivals("20")).thenReturn(new ArrivalsResponse("20", "Catedrala", NOW, false, List.of(
                new ArrivalDto("16", "Girație", NOW.plusSeconds(120), 2, true),
                new ArrivalDto("2", "Shopping City", NOW.plusSeconds(300), 5, true))));
        when(transit.lastDepartures("20")).thenReturn(new LastDeparturesResponse("20", "Catedrala", "TIMETABLE", List.of(
                new LastDepartureDto("2", "Shopping City", Instant.parse("2026-11-14T21:35:00Z")),
                new LastDepartureDto("16", "Girație", Instant.parse("2026-11-14T21:18:00Z")))));
        when(transit.alerts()).thenReturn(List.of(new AlertDto("A1", "Trams diverted", "...")));

        Map<String, Object> answer = tool.execute(Map.of("vehicle_type", "tram"), new ToolContext(USER, NOW));

        List<Map<String, Object>> stops = (List<Map<String, Object>>) answer.get("stops");
        assertThat(stops).extracting(s -> s.get("name")).containsExactly("Catedrala");
        Map<String, Object> stop = stops.getFirst();
        assertThat((List<Object>) stop.get("lines")).containsExactly("2 (TRAM)", "16 (TROLLEYBUS)");
        assertThat((List<Map<String, Object>>) stop.get("next_arrivals"))
                .extracting(a -> a.get("line")).containsExactly("2");
        List<Map<String, Object>> last = (List<Map<String, Object>>) stop.get("last_departures_today");
        assertThat(last).hasSize(1);
        assertThat(last.getFirst()).containsEntry("at", "23:35").containsEntry("type", "TRAM");
        assertThat(stop).containsEntry("last_departures_source", "timetable");
        assertThat(answer).containsEntry("alerts", List.of("Trams diverted"));
    }

    // Stop names match without accents; an unknown name gives a hint.
    @Test
    @SuppressWarnings("unchecked")
    void stopByName() {
        when(transit.stops(null)).thenReturn(List.of(new TransitStopDto("1", "Piața Libertății", 45.75, 21.22, List.of())));
        when(transit.routes()).thenReturn(List.of());
        when(transit.arrivals("1")).thenThrow(new ApiException(ErrorCode.SOURCE_UNAVAILABLE));
        when(transit.lastDepartures("1")).thenThrow(new ApiException(ErrorCode.SOURCE_UNAVAILABLE));
        when(transit.alerts()).thenThrow(new ApiException(ErrorCode.SOURCE_UNAVAILABLE));
        ToolContext context = new ToolContext(USER, NOW);

        Map<String, Object> found = tool.execute(Map.of("stop_name", "piata libertatii"), context);
        Map<String, Object> stop = ((List<Map<String, Object>>) found.get("stops")).getFirst();
        assertThat(stop).containsEntry("next_arrivals", "unavailable").containsEntry("last_departures_today", "unavailable");
        assertThat(found).containsEntry("alerts", "unavailable");

        Map<String, Object> missing = tool.execute(Map.of("stop_name", "Nowhere"), context);
        assertThat((List<Object>) missing.get("stops")).isEmpty();
        assertThat(missing).containsKey("hint");
    }

    // STPT down with nothing cached, or a bad vehicle type: an error message for the model.
    @Test
    void errors() {
        ToolContext context = new ToolContext(USER, NOW);
        assertThatThrownBy(() -> tool.execute(Map.of("vehicle_type", "rocket"), context)).isInstanceOf(ToolException.class);
        when(transit.stops(null)).thenThrow(new ApiException(ErrorCode.SOURCE_UNAVAILABLE));
        assertThatThrownBy(() -> tool.execute(Map.of(), context)).isInstanceOf(ToolException.class)
                .hasMessageContaining("not available");
    }
}
