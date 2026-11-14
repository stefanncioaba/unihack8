package com.unihack8.backend.ai.controller;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.unihack8.backend.ai.domain.dto.ChatCostDto;
import com.unihack8.backend.ai.domain.dto.ChatResponse;
import com.unihack8.backend.ai.domain.dto.CostItemDto;
import com.unihack8.backend.ai.domain.dto.ChatRouteDto;
import com.unihack8.backend.ai.domain.dto.LeaveNowDto;
import com.unihack8.backend.ai.domain.dto.RoutePointDto;
import com.unihack8.backend.ai.domain.dto.SourceDto;
import com.unihack8.backend.ai.service.AiChatService;
import com.unihack8.backend.common.exception.ApiException;
import com.unihack8.backend.common.exception.ErrorCode;
import com.unihack8.backend.places.domain.dto.PlaceSummaryDto;
import com.unihack8.backend.support.JwtTestTokens;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

/** POST /ai/chat end to end (security, validation, JSON shape), with the chat service mocked. */
@SpringBootTest
@AutoConfigureMockMvc
class AiControllerTest {

    private static final UUID USER = UUID.randomUUID();
    private static final String BEARER = "Bearer " + JwtTestTokens.valid(USER);
    private static final String BODY = """
            {"messages":[{"role":"user","content":"cheap coffee near me?"}],"location":{"lat":45.7537,"lon":21.2257}}""";

    @Autowired
    private MockMvc mvc;

    @MockitoBean
    private AiChatService chatService;

    // The assistant needs a signed-in user.
    @Test
    void withoutTokenIs401() throws Exception {
        mvc.perform(post("/ai/chat").contentType(MediaType.APPLICATION_JSON).content(BODY))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHORIZED"));
    }

    // Documented answer shape (docs/API.md): reply, places, events, sources, routes, cost.
    @Test
    void answerShape() throws Exception {
        UUID placeId = UUID.randomUUID();
        when(chatService.chat(eq(USER), any())).thenReturn(new ChatResponse("5 to go: espresso about 5 lei.",
                List.of(new PlaceSummaryDto(placeId, "node/1", "5 to go", "cafe", 45.75, 21.22, null, 127)),
                List.of(), List.of(new SourceDto("5 to go prices (playtech.ro)", "https://playtech.ro/x")),
                List.of(new ChatRouteDto(new RoutePointDto(45.7537, 21.2257, "Your location"),
                        new RoutePointDto(45.75, 21.22, "5 to go"), "WALK", 2, 127, true, null)),
                new ChatCostDto("RON", "TOTAL", List.of(new CostItemDto("5 to go", "Espresso", "MENU", 5.0, 5.0, 5.0)),
                        5.0, 5.0, 5.0, "Saved menu prices; they may have changed.")));

        mvc.perform(post("/ai/chat").header("Authorization", BEARER).contentType(MediaType.APPLICATION_JSON).content(BODY))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.reply").value("5 to go: espresso about 5 lei."))
                .andExpect(jsonPath("$.places[0].id").value(placeId.toString()))
                .andExpect(jsonPath("$.places[0].distanceMeters").value(127))
                .andExpect(jsonPath("$.events").isEmpty())
                .andExpect(jsonPath("$.sources[0].url").value("https://playtech.ro/x"))
                .andExpect(jsonPath("$.routes[0].from.name").value("Your location"))
                .andExpect(jsonPath("$.routes[0].to.lat").value(45.75))
                .andExpect(jsonPath("$.routes[0].to.name").value("5 to go"))
                .andExpect(jsonPath("$.routes[0].mode").value("WALK"))
                .andExpect(jsonPath("$.routes[0].durationMinutes").value(2))
                .andExpect(jsonPath("$.routes[0].distanceMeters").value(127))
                .andExpect(jsonPath("$.routes[0].startsFromUser").value(true))
                .andExpect(jsonPath("$.cost.currency").value("RON"))
                .andExpect(jsonPath("$.cost.basis").value("TOTAL"))
                .andExpect(jsonPath("$.cost.averageTotalLei").value(5.0))
                .andExpect(jsonPath("$.cost.minTotalLei").value(5.0))
                .andExpect(jsonPath("$.cost.maxTotalLei").value(5.0))
                .andExpect(jsonPath("$.cost.note").value("Saved menu prices; they may have changed."))
                .andExpect(jsonPath("$.cost.items[0].label").value("5 to go"))
                .andExpect(jsonPath("$.cost.items[0].detail").value("Espresso"))
                .andExpect(jsonPath("$.cost.items[0].kind").value("MENU"))
                .andExpect(jsonPath("$.cost.items[0].averageLei").value(5.0));
    }

    // "Leave now" on a transit route card (docs/API.md): ISO times in UTC; null on a walking route.
    @Test
    void leaveNowShape() throws Exception {
        LeaveNowDto leave = new LeaveNowDto("1", "TRAM", "Gara de Nord", "Piața Libertății", 4,
                Instant.parse("2026-11-14T18:41:00Z"), Instant.parse("2026-11-14T18:36:00Z"), "LIVE",
                Instant.parse("2026-11-14T18:33:00Z"));
        RoutePointDto from = new RoutePointDto(45.7537, 21.2257, "Your location");
        RoutePointDto to = new RoutePointDto(45.7505, 21.2075, "Gara de Nord");
        when(chatService.chat(eq(USER), any())).thenReturn(new ChatResponse("Leave in 6 min.", List.of(), List.of(), List.of(),
                List.of(new ChatRouteDto(from, to, "TRANSIT", 20, 3400, true, leave),
                        new ChatRouteDto(from, to, "WALK", 35, 2600, true, null)), null));

        mvc.perform(post("/ai/chat").header("Authorization", BEARER).contentType(MediaType.APPLICATION_JSON).content(BODY))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.routes[0].leaveNow.line").value("1"))
                .andExpect(jsonPath("$.routes[0].leaveNow.vehicleType").value("TRAM"))
                .andExpect(jsonPath("$.routes[0].leaveNow.headsign").value("Gara de Nord"))
                .andExpect(jsonPath("$.routes[0].leaveNow.stopName").value("Piața Libertății"))
                .andExpect(jsonPath("$.routes[0].leaveNow.walkMinutes").value(4))
                .andExpect(jsonPath("$.routes[0].leaveNow.boardAt").value("2026-11-14T18:41:00Z"))
                .andExpect(jsonPath("$.routes[0].leaveNow.leaveAt").value("2026-11-14T18:36:00Z"))
                .andExpect(jsonPath("$.routes[0].leaveNow.source").value("LIVE"))
                .andExpect(jsonPath("$.routes[0].leaveNow.missedBoardAt").value("2026-11-14T18:33:00Z"))
                .andExpect(jsonPath("$.routes[1].leaveNow").isEmpty());
    }

    // Location is optional (permission denied).
    @Test
    void locationOptional() throws Exception {
        when(chatService.chat(eq(USER), any())).thenReturn(new ChatResponse("ok", List.of(), List.of(), List.of(), List.of(), null));
        mvc.perform(post("/ai/chat").header("Authorization", BEARER).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"messages\":[{\"role\":\"user\",\"content\":\"hi\"}],\"location\":null}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.cost").isEmpty());
    }

    // Empty conversation, a bad role or an over-long message: 400.
    @Test
    void validation() throws Exception {
        mvc.perform(post("/ai/chat").header("Authorization", BEARER).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"messages\":[]}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
        mvc.perform(post("/ai/chat").header("Authorization", BEARER).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"messages\":[{\"role\":\"system\",\"content\":\"x\"}]}"))
                .andExpect(status().isBadRequest());
        mvc.perform(post("/ai/chat").header("Authorization", BEARER).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"messages\":[{\"role\":\"user\",\"content\":\"" + "a".repeat(2001) + "\"}]}"))
                .andExpect(status().isBadRequest());
    }

    // Rate limit and Gemini failures keep their documented codes.
    @Test
    void errorCodes() throws Exception {
        when(chatService.chat(eq(USER), any())).thenThrow(new ApiException(ErrorCode.RATE_LIMITED));
        mvc.perform(post("/ai/chat").header("Authorization", BEARER).contentType(MediaType.APPLICATION_JSON).content(BODY))
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.code").value("RATE_LIMITED"));

        when(chatService.chat(eq(USER), any())).thenThrow(new ApiException(ErrorCode.AI_UNAVAILABLE));
        mvc.perform(post("/ai/chat").header("Authorization", BEARER).contentType(MediaType.APPLICATION_JSON).content(BODY))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.code").value("AI_UNAVAILABLE"));
    }
}
