package com.unihack8.backend.ai.controller;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.unihack8.backend.ai.domain.dto.ChatResponse;
import com.unihack8.backend.ai.domain.dto.SourceDto;
import com.unihack8.backend.ai.service.AiChatService;
import com.unihack8.backend.common.exception.ApiException;
import com.unihack8.backend.common.exception.ErrorCode;
import com.unihack8.backend.places.domain.dto.PlaceSummaryDto;
import com.unihack8.backend.support.JwtTestTokens;
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

    // Documented answer shape (docs/API.md): reply, places, events, sources.
    @Test
    void answerShape() throws Exception {
        UUID placeId = UUID.randomUUID();
        when(chatService.chat(eq(USER), any())).thenReturn(new ChatResponse("5 to go: espresso about 5 lei.",
                List.of(new PlaceSummaryDto(placeId, "node/1", "5 to go", "cafe", 45.75, 21.22, null, 127)),
                List.of(), List.of(new SourceDto("5 to go prices (playtech.ro)", "https://playtech.ro/x"))));

        mvc.perform(post("/ai/chat").header("Authorization", BEARER).contentType(MediaType.APPLICATION_JSON).content(BODY))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.reply").value("5 to go: espresso about 5 lei."))
                .andExpect(jsonPath("$.places[0].id").value(placeId.toString()))
                .andExpect(jsonPath("$.places[0].distanceMeters").value(127))
                .andExpect(jsonPath("$.events").isEmpty())
                .andExpect(jsonPath("$.sources[0].url").value("https://playtech.ro/x"));
    }

    // Location is optional (permission denied).
    @Test
    void locationOptional() throws Exception {
        when(chatService.chat(eq(USER), any())).thenReturn(new ChatResponse("ok", List.of(), List.of(), List.of()));
        mvc.perform(post("/ai/chat").header("Authorization", BEARER).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"messages\":[{\"role\":\"user\",\"content\":\"hi\"}],\"location\":null}"))
                .andExpect(status().isOk());
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
