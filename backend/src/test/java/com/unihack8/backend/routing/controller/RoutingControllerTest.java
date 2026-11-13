package com.unihack8.backend.routing.controller;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.unihack8.backend.routing.client.OtpClient;
import com.unihack8.backend.routing.client.OtpUnavailableException;
import com.unihack8.backend.routing.domain.model.TravelMode;
import com.unihack8.backend.routing.mapper.impl.RoutePlanMapperImplTest;
import com.unihack8.backend.support.JwtTestTokens;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

/** GET /routes/plan end to end (security, validation, JSON shape), with OTP mocked. */
@SpringBootTest
@AutoConfigureMockMvc
class RoutingControllerTest {

    private static final String BEARER = "Bearer " + JwtTestTokens.valid(UUID.randomUUID());
    private static final String FROM = "45.7537,21.2257";
    private static final String TO = "45.7505,21.2075";

    @Autowired
    private MockMvc mvc;

    @MockitoBean
    private OtpClient otp;

    // Directions need a signed-in user.
    @Test
    void withoutTokenIs401() throws Exception {
        mvc.perform(get("/routes/plan").param("from", FROM).param("to", TO).param("mode", "WALK"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHORIZED"));
    }

    // Transit route in the documented JSON shape (docs/API.md), times in UTC.
    @Test
    void transitRoute() throws Exception {
        Instant departAt = Instant.parse("2026-11-14T18:00:00Z");
        when(otp.plan(any(), any(), eq(TravelMode.TRANSIT), eq(departAt)))
                .thenReturn(List.of(RoutePlanMapperImplTest.transitItinerary()));

        mvc.perform(get("/routes/plan").header("Authorization", BEARER)
                        .param("from", FROM).param("to", TO).param("mode", "TRANSIT")
                        .param("departAt", "2026-11-14T18:00:00Z"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.mode").value("TRANSIT"))
                .andExpect(jsonPath("$.durationMinutes").value(18))
                .andExpect(jsonPath("$.distanceMeters").value(3400))
                .andExpect(jsonPath("$.startsAt").value("2026-11-14T18:02:00Z"))
                .andExpect(jsonPath("$.endsAt").value("2026-11-14T18:20:00Z"))
                .andExpect(jsonPath("$.fallback").value(false))
                .andExpect(jsonPath("$.legs[0].mode").value("WALK"))
                .andExpect(jsonPath("$.legs[0].route").isEmpty())
                .andExpect(jsonPath("$.legs[1].mode").value("TRAM"))
                .andExpect(jsonPath("$.legs[1].route").value("1"))
                .andExpect(jsonPath("$.legs[1].headsign").value("Gara de Nord"))
                .andExpect(jsonPath("$.legs[1].from.name").value("Piața Libertății"))
                .andExpect(jsonPath("$.legs[1].polyline").value("u~l~Fjk~uOwHJy@Pq@d@"));
    }

    // Walking with OTP down still answers 200 with the straight-line estimate.
    @Test
    void walkWithOtpDownIsFallback() throws Exception {
        when(otp.plan(any(), any(), any(), any())).thenThrow(new OtpUnavailableException("down", null));

        mvc.perform(get("/routes/plan").header("Authorization", BEARER)
                        .param("from", FROM).param("to", TO).param("mode", "WALK"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.mode").value("WALK"))
                .andExpect(jsonPath("$.fallback").value(true))
                .andExpect(jsonPath("$.legs.length()").value(1));
    }

    // Transit with OTP down is 503 SOURCE_UNAVAILABLE.
    @Test
    void transitWithOtpDownIs503() throws Exception {
        when(otp.plan(any(), any(), any(), any())).thenThrow(new OtpUnavailableException("down", null));

        mvc.perform(get("/routes/plan").header("Authorization", BEARER)
                        .param("from", FROM).param("to", TO).param("mode", "TRANSIT"))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.code").value("SOURCE_UNAVAILABLE"));
    }

    // Bad coordinates are 400 VALIDATION_FAILED.
    @Test
    void badCoordinatesAre400() throws Exception {
        mvc.perform(get("/routes/plan").header("Authorization", BEARER)
                        .param("from", "not-a-point").param("to", TO).param("mode", "WALK"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
    }

    // Unknown mode, missing parameter and bad time are 400 VALIDATION_FAILED.
    @Test
    void badParametersAre400() throws Exception {
        mvc.perform(get("/routes/plan").header("Authorization", BEARER)
                        .param("from", FROM).param("to", TO).param("mode", "CAR"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
        mvc.perform(get("/routes/plan").header("Authorization", BEARER)
                        .param("from", FROM).param("mode", "WALK"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fields.to").value("is required"));
        mvc.perform(get("/routes/plan").header("Authorization", BEARER)
                        .param("from", FROM).param("to", TO).param("mode", "WALK").param("departAt", "tomorrow"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
    }
}
