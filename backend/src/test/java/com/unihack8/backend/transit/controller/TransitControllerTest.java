package com.unihack8.backend.transit.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.unihack8.backend.common.exception.ApiException;
import com.unihack8.backend.common.exception.ErrorCode;
import com.unihack8.backend.common.geo.GeoPoint;
import com.unihack8.backend.transit.domain.dto.AlertDto;
import com.unihack8.backend.transit.domain.dto.ArrivalDto;
import com.unihack8.backend.transit.domain.dto.ArrivalsResponse;
import com.unihack8.backend.transit.domain.dto.LastDepartureDto;
import com.unihack8.backend.transit.domain.dto.LastDeparturesResponse;
import com.unihack8.backend.transit.domain.dto.NearestStopDto;
import com.unihack8.backend.transit.domain.dto.TransitRouteDto;
import com.unihack8.backend.transit.domain.dto.TransitStopDto;
import com.unihack8.backend.transit.domain.dto.TransitSummaryResponse;
import com.unihack8.backend.transit.domain.dto.VehicleDto;
import com.unihack8.backend.transit.domain.dto.VehiclesResponse;
import com.unihack8.backend.transit.service.TransitService;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

/** HTTP shape of the transit endpoints (docs/API.md -> Transit); all public, no token. */
@SpringBootTest
@AutoConfigureMockMvc
class TransitControllerTest {

    private static final Instant T = Instant.parse("2026-11-14T18:00:05Z");

    @Autowired
    private MockMvc mvc;

    @MockitoBean
    private TransitService transit;

    // Routes list without a token.
    @Test
    void routes() throws Exception {
        when(transit.routes()).thenReturn(List.of(
                new TransitRouteDto("1", "TRAM", "1", "Gara de Nord", "Piața Gh. Domășneanu (AEM)", "#e3a900")));
        mvc.perform(get("/transit/routes"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value("1"))
                .andExpect(jsonPath("$[0].type").value("TRAM"))
                .andExpect(jsonPath("$[0].from").value("Gara de Nord"))
                .andExpect(jsonPath("$[0].color").value("#e3a900"));
    }

    // Stops with and without bbox; a bad bbox is 400.
    @Test
    void stops() throws Exception {
        when(transit.stops(any())).thenReturn(List.of(
                new TransitStopDto("1", "Dâmbovița (Ion Barac)", 45.74015, 21.19611, List.of("2", "9"))));
        mvc.perform(get("/transit/stops").param("bbox", "21.18,45.73,21.26,45.77"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].lat").value(45.74015))
                .andExpect(jsonPath("$[0].routes[1]").value("9"));
        mvc.perform(get("/transit/stops").param("bbox", "1,2"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
    }

    // Vehicles answer with stale flag and ISO times; missing route is 400.
    @Test
    void vehicles() throws Exception {
        when(transit.vehicles("1")).thenReturn(new VehiclesResponse("1", T, true, List.of(
                new VehicleDto("1010", 45.73853, 21.22507, 20.2, 10.0, "Gara de Nord", "Memorandumului", true,
                        Instant.parse("2026-11-14T18:00:01Z")))));
        mvc.perform(get("/transit/vehicles").param("route", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.stale").value(true))
                .andExpect(jsonPath("$.updatedAt").value("2026-11-14T18:00:05Z"))
                .andExpect(jsonPath("$.vehicles[0].lon").value(21.22507))
                .andExpect(jsonPath("$.vehicles[0].nextStop").value("Memorandumului"))
                .andExpect(jsonPath("$.vehicles[0].reportedAt").value("2026-11-14T18:00:01Z"));
        mvc.perform(get("/transit/vehicles"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
    }

    // STPT down with nothing cached is 503 SOURCE_UNAVAILABLE.
    @Test
    void sourceUnavailable() throws Exception {
        when(transit.vehicles("1")).thenThrow(new ApiException(ErrorCode.SOURCE_UNAVAILABLE));
        mvc.perform(get("/transit/vehicles").param("route", "1"))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.code").value("SOURCE_UNAVAILABLE"));
    }

    // Arrivals for a stop; unknown stop is 404.
    @Test
    void arrivals() throws Exception {
        when(transit.arrivals("1")).thenReturn(new ArrivalsResponse("1", "Dâmbovița (Ion Barac)", T, false,
                List.of(new ArrivalDto("2", "Shopping City", Instant.parse("2026-11-14T18:04:00Z"), 4, true))));
        when(transit.arrivals("404")).thenThrow(ApiException.notFound("Stop"));
        mvc.perform(get("/transit/stops/1/arrivals"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.stopName").value("Dâmbovița (Ion Barac)"))
                .andExpect(jsonPath("$.arrivals[0].arrivesAt").value("2026-11-14T18:04:00Z"))
                .andExpect(jsonPath("$.arrivals[0].minutes").value(4))
                .andExpect(jsonPath("$.arrivals[0].live").value(true));
        mvc.perform(get("/transit/stops/404/arrivals"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_FOUND"));
    }

    // Alerts list.
    @Test
    void alerts() throws Exception {
        when(transit.alerts()).thenReturn(List.of(new AlertDto("A155", "Trams diverted", "Details")));
        mvc.perform(get("/transit/alerts"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].title").value("Trams diverted"));
    }

    // Last departures with their source.
    @Test
    void lastDepartures() throws Exception {
        when(transit.lastDepartures("1")).thenReturn(new LastDeparturesResponse("1", "Dâmbovița (Ion Barac)",
                "LIVE_ESTIMATE", List.of(new LastDepartureDto("2", "Shopping City",
                Instant.parse("2026-11-14T21:41:00Z")))));
        mvc.perform(get("/transit/last-departures").param("stopId", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.source").value("LIVE_ESTIMATE"))
                .andExpect(jsonPath("$.departures[0].lastDepartureAt").value("2026-11-14T21:41:00Z"));
    }

    // Summary parses near and picks the language from Accept-Language (English by default).
    @Test
    void summary() throws Exception {
        TransitSummaryResponse body = new TransitSummaryResponse(
                new NearestStopDto("1", "Dâmbovița (Ion Barac)", 230), List.of(), 1, "msg");
        when(transit.summary(any(), any())).thenReturn(body);

        mvc.perform(get("/transit/summary").param("near", "45.7537,21.2257").header("Accept-Language", "ro-RO,ro;q=0.9"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.nearestStop.distanceMeters").value(230))
                .andExpect(jsonPath("$.activeAlerts").value(1))
                .andExpect(jsonPath("$.message").value("msg"));
        verify(transit).summary(eq(new GeoPoint(45.7537, 21.2257)), eq(Locale.of("ro")));

        mvc.perform(get("/transit/summary").param("near", "45.7537,21.2257"))
                .andExpect(status().isOk());
        verify(transit).summary(any(), eq(Locale.ENGLISH));

        mvc.perform(get("/transit/summary").param("near", "nowhere"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
    }

    // Accept-Language parsing: only a leading "ro" means Romanian.
    @Test
    void languageChoice() {
        assertThat(TransitController.language(null)).isEqualTo(Locale.ENGLISH);
        assertThat(TransitController.language("en-US,ro;q=0.9")).isEqualTo(Locale.ENGLISH);
        assertThat(TransitController.language("RO")).isEqualTo(Locale.of("ro"));
    }
}
