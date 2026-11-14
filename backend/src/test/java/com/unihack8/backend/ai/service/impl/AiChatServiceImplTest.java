package com.unihack8.backend.ai.service.impl;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.unihack8.backend.ai.client.GeminiClient;
import com.unihack8.backend.ai.client.GeminiException;
import com.unihack8.backend.ai.config.AiProperties;
import com.unihack8.backend.ai.config.GeminiProperties;
import com.unihack8.backend.ai.domain.ToolContext;
import com.unihack8.backend.ai.domain.dto.ChatMessageDto;
import com.unihack8.backend.ai.domain.dto.ChatRequest;
import com.unihack8.backend.ai.domain.dto.ChatResponse;
import com.unihack8.backend.ai.domain.dto.LocationDto;
import com.unihack8.backend.ai.domain.gemini.GeminiContent;
import com.unihack8.backend.ai.domain.gemini.GeminiFunctionCall;
import com.unihack8.backend.ai.domain.gemini.GeminiPart;
import com.unihack8.backend.ai.domain.gemini.GeminiRequest;
import com.unihack8.backend.ai.domain.gemini.GeminiResponse;
import com.unihack8.backend.ai.mapper.impl.ChatResultMapperImpl;
import com.unihack8.backend.ai.service.LeaveNowService;
import com.unihack8.backend.ai.tool.AiTool;
import com.unihack8.backend.ai.tool.ToolException;
import com.unihack8.backend.ai.tool.impl.PlanRouteTool;
import com.unihack8.backend.routing.domain.dto.RoutePlanResponse;
import com.unihack8.backend.routing.service.RoutingService;
import com.unihack8.backend.common.exception.ApiException;
import com.unihack8.backend.common.exception.ErrorCode;
import com.unihack8.backend.places.domain.dto.PlaceSummaryDto;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Supplier;
import org.junit.jupiter.api.Test;

/** Tool-calling loop with a fake Gemini client (PLAN 11.6): no network, no real model. */
class AiChatServiceImplTest {

    private static final Instant NOW = Instant.parse("2026-11-14T16:00:00Z");
    private static final UUID USER = UUID.randomUUID();
    private static final UUID PLACE_ID = UUID.randomUUID();

    private final FakeGemini gemini = new FakeGemini();
    private final List<Duration> sleeps = new ArrayList<>();
    private final FakeTool tool = new FakeTool();

    // Model asks for a tool, gets its result (same call id, signature echoed), then answers in text.
    @Test
    void toolCallLoop() {
        gemini.answer(content(new GeminiPart(null, null, "sig-1",
                new GeminiFunctionCall("call-1", "fake_places", Map.of("keyword", "coffee")), null)));
        gemini.answer(content(new GeminiPart("Thinking...", true, null, null, null),
                GeminiPart.text("Go to **Cafe Test**, espresso about 5 lei.")));

        ChatResponse response = service(2).chat(USER, request("cheap coffee?"));

        assertThat(response.reply()).isEqualTo("Go to Cafe Test, espresso about 5 lei.");
        assertThat(response.places()).extracting(PlaceSummaryDto::id).containsExactly(PLACE_ID);
        // "5 lei" is only in the model text (the tool stored no price): no cost box, never a guess.
        assertThat(response.cost()).isNull();
        assertThat(tool.lastArgs).containsEntry("keyword", "coffee");

        GeminiRequest second = gemini.requests.get(1);
        assertThat(second.contents()).hasSize(3);
        GeminiPart echoed = second.contents().get(1).parts().getFirst();
        assertThat(second.contents().get(1).role()).isEqualTo("model");
        assertThat(echoed.thoughtSignature()).isEqualTo("sig-1");
        GeminiPart result = second.contents().get(2).parts().getFirst();
        assertThat(second.contents().get(2).role()).isEqualTo("user");
        assertThat(result.functionResponse().id()).isEqualTo("call-1");
        assertThat(result.functionResponse().response()).containsEntry("count", 1);
        // The system prompt carries the local time and the user location.
        String system = second.systemInstruction().parts().getFirst().text();
        assertThat(system).contains("Saturday 14 November 2026, 18:00").contains("lat 45.75");
        assertThat(gemini.models).containsExactly("model-a", "model-a");
    }

    // Routes plan_route planned during the request come back in routes[], from the user (PLAN 18.2).
    @Test
    void plannedRoutesInTheAnswer() {
        RoutingService routing = mock(RoutingService.class);
        when(routing.plan(any(), any(), any(), any()))
                .thenReturn(new RoutePlanResponse("WALK", 6, 450, NOW, NOW.plusSeconds(360), false, List.of()));
        gemini.answer(content(GeminiPart.functionCall(new GeminiFunctionCall("a", "fake_places", Map.of()))));
        gemini.answer(content(GeminiPart.functionCall(new GeminiFunctionCall("b", "plan_route",
                Map.of("to_lat", 45.75, "to_lon", 21.22, "mode", "WALK")))));
        gemini.answer(content(GeminiPart.text("Walk to **Cafe Test**, 6 minutes.")));

        ChatResponse response = service(3, List.of(tool, new PlanRouteTool(routing, mock(LeaveNowService.class)))).chat(USER, request("how do I get to a cafe?"));

        assertThat(response.routes()).singleElement().satisfies(route -> {
            assertThat(route.startsFromUser()).isTrue();
            assertThat(route.from().name()).isEqualTo("Your location");
            assertThat(route.to().name()).isEqualTo("Cafe Test");
            assertThat(route.mode()).isEqualTo("WALK");
            assertThat(route.durationMinutes()).isEqualTo(6);
        });
    }

    // An answer without plan_route has an empty routes list, never null.
    @Test
    void noRoutesIsEmpty() {
        gemini.answer(content(GeminiPart.text("Hello!")));
        assertThat(service(2).chat(USER, request("hi")).routes()).isEmpty();
    }

    // A tool that finds nothing still lets the model answer.
    @Test
    void emptyToolResult() {
        tool.empty = true;
        gemini.answer(content(GeminiPart.functionCall(new GeminiFunctionCall("c", "fake_places", Map.of()))));
        gemini.answer(content(GeminiPart.text("I found no cafes nearby.")));

        ChatResponse response = service(3).chat(USER, request("coffee?"));
        assertThat(response.reply()).isEqualTo("I found no cafes nearby.");
        assertThat(response.places()).isEmpty();
        assertThat(gemini.requests.get(1).contents().get(2).parts().getFirst().functionResponse().response())
                .containsEntry("count", 0);
    }

    // Bad arguments, unknown tools and crashes become error results the model can read.
    @Test
    void toolErrorsGoBackToTheModel() {
        tool.failWith = new ToolException("unknown category boat");
        gemini.answer(content(
                GeminiPart.functionCall(new GeminiFunctionCall("a", "fake_places", Map.of())),
                GeminiPart.functionCall(new GeminiFunctionCall("b", "no_such_tool", Map.of()))));
        gemini.answer(content(GeminiPart.text("Sorry.")));

        service(3).chat(USER, request("x"));
        List<GeminiPart> results = gemini.requests.get(1).contents().get(2).parts();
        assertThat(results).hasSize(2);
        assertThat(results.get(0).functionResponse().response()).containsEntry("error", "unknown category boat");
        assertThat((String) results.get(1).functionResponse().response().get("error")).startsWith("Unknown tool no_such_tool");
    }

    // On the last round tools are switched off (mode NONE) so the model must answer.
    @Test
    void lastRoundForcesAnAnswer() {
        gemini.answer(content(GeminiPart.functionCall(new GeminiFunctionCall("a", "fake_places", Map.of()))));
        gemini.answer(content(GeminiPart.functionCall(new GeminiFunctionCall("b", "fake_places", Map.of())),
                GeminiPart.text("Here is what I know.")));

        ChatResponse response = service(1).chat(USER, request("x"));
        assertThat(response.reply()).isEqualTo("Here is what I know.");
        assertThat(mode(gemini.requests.get(0))).isEqualTo("AUTO");
        assertThat(mode(gemini.requests.get(1))).isEqualTo("NONE");
    }

    // A blocked or empty answer gives the polite fallback text.
    @Test
    void emptyAnswer() {
        gemini.respond(() -> new GeminiResponse(List.of(), "model-a"));
        assertThat(service(2).chat(USER, request("x")).reply()).isEqualTo(AiChatServiceImpl.FALLBACK_REPLY);
    }

    // A busy model (503) falls back to the next one, which then stays in use.
    @Test
    void busyModelFallsBack() {
        gemini.respond(() -> {
            throw new GeminiException("503", true, null);
        });
        gemini.answer(content(GeminiPart.functionCall(new GeminiFunctionCall("a", "fake_places", Map.of()))));
        gemini.answer(content(GeminiPart.text("ok")));

        assertThat(service(2).chat(USER, request("x")).reply()).isEqualTo("ok");
        assertThat(gemini.models).containsExactly("model-a", "model-b", "model-b");
    }

    // A 429 with a short retryDelay is waited out once on the same model.
    @Test
    void quotaRetryWaitsOnce() {
        gemini.respond(() -> {
            throw new GeminiException("429", true, Duration.ofSeconds(3), null);
        });
        gemini.answer(content(GeminiPart.text("ok")));

        assertThat(service(2).chat(USER, request("x")).reply()).isEqualTo("ok");
        assertThat(sleeps).containsExactly(Duration.ofSeconds(3));
        assertThat(gemini.models).containsExactly("model-a", "model-a");
    }

    // Provider errors end as 503 AI_UNAVAILABLE: a non-retryable error stops at once.
    @Test
    void providerError() {
        gemini.respond(() -> {
            throw new GeminiException("400 bad request", false, null);
        });
        assertThatThrownBy(() -> service(2).chat(USER, request("x")))
                .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.code()).isEqualTo(ErrorCode.AI_UNAVAILABLE));
        assertThat(gemini.models).containsExactly("model-a");
    }

    // Every model busy: 503 with the "busy" message.
    @Test
    void allModelsBusy() {
        for (int i = 0; i < 2; i++) {
            gemini.respond(() -> {
                throw new GeminiException("503", true, null);
            });
        }
        assertThatThrownBy(() -> service(2).chat(USER, request("x")))
                .isInstanceOfSatisfying(ApiException.class, e -> {
                    assertThat(e.code()).isEqualTo(ErrorCode.AI_UNAVAILABLE);
                    assertThat(e.getMessage()).contains("busy");
                });
    }

    // 19.4: a refusal is a normal answer: reply text, no tool run, all lists empty (not null).
    @Test
    void refusalIsANormalAnswerWithEmptyLists() {
        gemini.answer(content(GeminiPart.text(
                "I can only help with places, food, events, public transport and directions in Timisoara.")));

        ChatResponse response = service(3).chat(USER, request("Write me a Python script that sorts a list."));

        assertThat(response.reply()).startsWith("I can only help with");
        assertThat(response.places()).isNotNull().isEmpty();
        assertThat(response.events()).isNotNull().isEmpty();
        assertThat(response.sources()).isNotNull().isEmpty();
        assertThat(tool.lastArgs).isNull();
        assertThat(gemini.requests).hasSize(1);
        assertThat(gemini.requests.getFirst().systemInstruction().parts().getFirst().text())
                .contains(SystemPrompt.SCOPE);
    }

    // A refusal after an in-scope turn names no place, so earlier places do not come back as cards.
    @Test
    void refusalAfterCityTurnHasNoCards() {
        gemini.answer(content(GeminiPart.text("Pot ajuta doar cu locuri, mâncare, evenimente, transport și "
                + "direcții în Timișoara.")));

        ChatResponse response = service(3).chat(USER, new ChatRequest(List.of(
                new ChatMessageDto("user", "cafea ieftină?"),
                new ChatMessageDto("assistant", "**Cafe Test**: espresso aproximativ 5 lei."),
                new ChatMessageDto("user", "Acum scrie-mi un eseu despre Cafe Test.")),
                new LocationDto(45.7537, 21.2257)));

        assertThat(response.places()).isEmpty();
        assertThat(response.events()).isEmpty();
        assertThat(response.sources()).isEmpty();
        assertThat(gemini.requests.getFirst().contents()).hasSize(3);
    }

    // Conversation rules: oldest dropped past the limit, leading assistant messages dropped, last must be user.
    @Test
    void conversationRules() {
        AiChatServiceImpl service = service(2);
        List<ChatMessageDto> messages = new ArrayList<>();
        messages.add(new ChatMessageDto("assistant", "Hi! Ask me anything."));
        for (int i = 0; i < 25; i++) {
            messages.add(new ChatMessageDto(i % 2 == 0 ? "user" : "assistant", "m" + i));
        }
        List<GeminiContent> contents = service.toContents(messages);
        assertThat(contents.getFirst().role()).isEqualTo("user");
        assertThat(contents.getLast().parts().getFirst().text()).isEqualTo("m24");
        assertThat(contents.size()).isLessThanOrEqualTo(20);
        assertThat(contents.get(1).role()).isEqualTo("model");

        assertThatThrownBy(() -> service.chat(USER, new ChatRequest(
                List.of(new ChatMessageDto("user", "a"), new ChatMessageDto("assistant", "b")), null)))
                .isInstanceOfSatisfying(ApiException.class, e -> assertThat(e.code()).isEqualTo(ErrorCode.VALIDATION_FAILED));
        assertThat(gemini.requests).isEmpty();
    }

    // Service with two models, the fake tool, a fixed clock and a recording sleeper.
    private AiChatServiceImpl service(int maxToolRounds) {
        return service(maxToolRounds, List.of(tool));
    }

    // Same, with the given tools.
    private AiChatServiceImpl service(int maxToolRounds, List<AiTool> tools) {
        return new AiChatServiceImpl(gemini,
                new GeminiProperties("key", "http://unused", List.of("model-a", "model-b"),
                        Duration.ofSeconds(1), Duration.ofSeconds(1)),
                new AiProperties(maxToolRounds, 20, 5, Duration.ofSeconds(12)),
                new ChatResultMapperImpl(), tools, Clock.fixed(NOW, ZoneOffset.UTC), sleeps::add);
    }

    // One user message at Piața Victoriei.
    private static ChatRequest request(String text) {
        return new ChatRequest(List.of(new ChatMessageDto("user", text)), new LocationDto(45.7537, 21.2257));
    }

    // Model turn with the given parts.
    private static GeminiContent content(GeminiPart... parts) {
        return new GeminiContent("model", List.of(parts));
    }

    // Function calling mode of a request.
    @SuppressWarnings("unchecked")
    private static String mode(GeminiRequest request) {
        return (String) ((Map<String, Object>) request.toolConfig().get("functionCallingConfig")).get("mode");
    }

    /** Gemini fake: answers from a queue and records every request and model name. */
    private static final class FakeGemini implements GeminiClient {
        final Deque<Supplier<GeminiResponse>> answers = new ArrayDeque<>();
        final List<GeminiRequest> requests = new ArrayList<>();
        final List<String> models = new ArrayList<>();

        // Queues a normal answer.
        void answer(GeminiContent content) {
            answers.add(() -> new GeminiResponse(List.of(new GeminiResponse.Candidate(content, "STOP")), "fake"));
        }

        // Queues any behaviour (answer or exception).
        void respond(Supplier<GeminiResponse> behaviour) {
            answers.add(behaviour);
        }

        // Records the call, then plays the next queued behaviour.
        @Override
        public GeminiResponse generate(String model, GeminiRequest request) {
            models.add(model);
            requests.add(new GeminiRequest(request.systemInstruction(), List.copyOf(request.contents()),
                    request.tools(), request.toolConfig()));
            return answers.removeFirst().get();
        }
    }

    /** Tool that returns one place (and remembers it), nothing, or fails. */
    private static final class FakeTool implements AiTool {
        boolean empty;
        RuntimeException failWith;
        Map<String, Object> lastArgs;

        // Tool name.
        @Override
        public String name() {
            return "fake_places";
        }

        // Minimal declaration.
        @Override
        public Map<String, Object> declaration() {
            return Map.of("name", name(), "description", "test", "parameters", Map.of("type", "object"));
        }

        // Returns one remembered place unless told otherwise.
        @Override
        public Map<String, Object> execute(Map<String, Object> args, ToolContext context) {
            lastArgs = args;
            if (failWith != null) {
                throw failWith;
            }
            if (empty) {
                return Map.of("count", 0);
            }
            context.rememberPlace(new PlaceSummaryDto(PLACE_ID, "node/1", "Cafe Test", "cafe", 45.75, 21.22, null, 50),
                    List.of());
            return Map.of("count", 1);
        }
    }
}
