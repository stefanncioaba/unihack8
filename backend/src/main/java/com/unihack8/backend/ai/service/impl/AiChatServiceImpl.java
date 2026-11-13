package com.unihack8.backend.ai.service.impl;

import com.unihack8.backend.ai.client.GeminiClient;
import com.unihack8.backend.ai.client.GeminiException;
import com.unihack8.backend.ai.config.AiProperties;
import com.unihack8.backend.ai.config.GeminiProperties;
import com.unihack8.backend.ai.domain.ToolContext;
import com.unihack8.backend.ai.domain.dto.ChatMessageDto;
import com.unihack8.backend.ai.domain.dto.ChatRequest;
import com.unihack8.backend.ai.domain.dto.ChatResponse;
import com.unihack8.backend.ai.domain.gemini.GeminiContent;
import com.unihack8.backend.ai.domain.gemini.GeminiFunctionCall;
import com.unihack8.backend.ai.domain.gemini.GeminiFunctionResponse;
import com.unihack8.backend.ai.domain.gemini.GeminiPart;
import com.unihack8.backend.ai.domain.gemini.GeminiRequest;
import com.unihack8.backend.ai.domain.gemini.GeminiResponse;
import com.unihack8.backend.ai.mapper.ChatResultMapper;
import com.unihack8.backend.ai.service.AiChatService;
import com.unihack8.backend.ai.service.ChatRateLimiter;
import com.unihack8.backend.ai.tool.AiTool;
import com.unihack8.backend.ai.tool.ToolException;
import com.unihack8.backend.common.exception.ApiException;
import com.unihack8.backend.common.exception.ErrorCode;
import com.unihack8.backend.common.geo.GeoPoint;
import java.time.Clock;
import java.time.Duration;
import org.springframework.beans.factory.annotation.Autowired;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * Tool-calling loop (PLAN 11.1, 11.2): send the conversation to Gemini; while it asks for tools,
 * run them (in parallel) and send the results back; on the last round tools are switched off so
 * the model must answer. Free-tier models are tried in order when one is busy.
 */
@Service
public class AiChatServiceImpl implements AiChatService {

    private static final Logger log = LoggerFactory.getLogger(AiChatServiceImpl.class);

    static final String FALLBACK_REPLY =
            "Sorry, I could not put an answer together. Please try asking in a different way.";

    private final GeminiClient gemini;
    private final GeminiProperties geminiProperties;
    private final AiProperties aiProperties;
    private final ChatRateLimiter rateLimiter;
    private final ChatResultMapper resultMapper;
    private final Map<String, AiTool> tools;
    private final Clock clock;
    private final Sleeper sleeper;

    // Wires Gemini, settings, the rate limiter, the result mapper, every AiTool bean and the clock.
    @Autowired
    public AiChatServiceImpl(GeminiClient gemini, GeminiProperties geminiProperties, AiProperties aiProperties,
                             ChatRateLimiter rateLimiter, ChatResultMapper resultMapper, List<AiTool> tools,
                             Clock clock) {
        this(gemini, geminiProperties, aiProperties, rateLimiter, resultMapper, tools, clock, Sleeper.REAL);
    }

    // Same, with a replaceable sleep (tests do not wait for real).
    AiChatServiceImpl(GeminiClient gemini, GeminiProperties geminiProperties, AiProperties aiProperties,
                      ChatRateLimiter rateLimiter, ChatResultMapper resultMapper, List<AiTool> tools,
                      Clock clock, Sleeper sleeper) {
        this.sleeper = sleeper;
        this.gemini = gemini;
        this.geminiProperties = geminiProperties;
        this.aiProperties = aiProperties;
        this.rateLimiter = rateLimiter;
        this.resultMapper = resultMapper;
        this.tools = tools.stream().collect(Collectors.toMap(AiTool::name, Function.identity(),
                (a, b) -> a, LinkedHashMap::new));
        this.clock = clock;
    }

    // Validates, rate-limits, runs the tool loop and builds the answer.
    @Override
    public ChatResponse chat(UUID userId, ChatRequest request) {
        List<GeminiContent> contents = toContents(request.messages());
        rateLimiter.acquire(userId);
        GeoPoint location = request.location() == null ? null
                : new GeoPoint(request.location().lat(), request.location().lon());
        ToolContext context = new ToolContext(location, clock.instant());
        GeminiContent system = GeminiContent.text(null, SystemPrompt.build(context));
        List<Map<String, Object>> toolDeclarations = List.of(Map.of("functionDeclarations",
                tools.values().stream().map(AiTool::declaration).toList()));

        ModelPicker models = new ModelPicker(geminiProperties.chatModels());
        for (int round = 0; round <= aiProperties.maxToolRounds(); round++) {
            boolean lastRound = round == aiProperties.maxToolRounds();
            GeminiRequest geminiRequest = new GeminiRequest(system, contents, toolDeclarations,
                    Map.of("functionCallingConfig", Map.of("mode", lastRound ? "NONE" : "AUTO")));
            GeminiContent answer = models.generate(geminiRequest);
            if (answer == null || answer.parts() == null || answer.parts().isEmpty()) {
                return resultMapper.toResponse(FALLBACK_REPLY, context);
            }
            List<GeminiFunctionCall> calls = answer.parts().stream()
                    .map(GeminiPart::functionCall).filter(Objects::nonNull).toList();
            if (calls.isEmpty() || lastRound) {
                String text = answer.parts().stream().map(GeminiPart::visibleText).filter(Objects::nonNull)
                        .collect(Collectors.joining()).trim();
                return resultMapper.toResponse(text.isEmpty() ? FALLBACK_REPLY : text, context);
            }
            // Echo the model turn unchanged (it carries thought signatures), then the tool results.
            contents.add(new GeminiContent("model", answer.parts()));
            contents.add(new GeminiContent("user", runTools(calls, context)));
        }
        return resultMapper.toResponse(FALLBACK_REPLY, context);
    }

    /**
     * App messages to Gemini turns: keeps the last maxMessages, drops leading assistant messages
     * (Gemini wants the user first) and requires the last message to be the user's.
     */
    List<GeminiContent> toContents(List<ChatMessageDto> messages) {
        List<ChatMessageDto> recent = messages.subList(Math.max(0, messages.size() - aiProperties.maxMessages()),
                messages.size());
        int first = 0;
        while (first < recent.size() && !"user".equals(recent.get(first).role())) {
            first++;
        }
        List<GeminiContent> contents = new ArrayList<>();
        for (ChatMessageDto message : recent.subList(first, recent.size())) {
            contents.add(GeminiContent.text("user".equals(message.role()) ? "user" : "model", message.content().trim()));
        }
        if (contents.isEmpty() || !"user".equals(contents.getLast().role())) {
            throw new ApiException(ErrorCode.VALIDATION_FAILED, "The last message must be from the user.");
        }
        return contents;
    }

    // Runs the requested tools in parallel; every failure becomes an error result the model can read.
    private List<GeminiPart> runTools(List<GeminiFunctionCall> calls, ToolContext context) {
        try (ExecutorService executor = Executors.newVirtualThreadPerTaskExecutor()) {
            List<Future<Map<String, Object>>> futures = calls.stream()
                    .map(call -> executor.submit(() -> runTool(call, context)))
                    .toList();
            List<GeminiPart> parts = new ArrayList<>();
            for (int i = 0; i < calls.size(); i++) {
                GeminiFunctionCall call = calls.get(i);
                Map<String, Object> result;
                try {
                    result = futures.get(i).get(aiProperties.toolTimeoutSeconds(), TimeUnit.SECONDS);
                } catch (TimeoutException e) {
                    futures.get(i).cancel(true);
                    result = Map.of("error", "The tool took too long. Answer without it.");
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                    result = Map.of("error", "Interrupted.");
                } catch (ExecutionException e) {
                    result = Map.of("error", "The tool failed. Answer without it.");
                }
                parts.add(GeminiPart.functionResponse(new GeminiFunctionResponse(call.id(), call.name(), result)));
            }
            return parts;
        }
    }

    // One tool call: unknown tools and bad arguments are reported back to the model.
    private Map<String, Object> runTool(GeminiFunctionCall call, ToolContext context) {
        AiTool tool = tools.get(call.name());
        if (tool == null) {
            return Map.of("error", "Unknown tool " + call.name() + ". Available: " + tools.keySet());
        }
        Map<String, Object> args = call.args() == null ? Map.of() : call.args();
        try {
            long start = System.nanoTime();
            Map<String, Object> result = tool.execute(args, context);
            log.info("AI tool {} {} -> {} ms", call.name(), args, (System.nanoTime() - start) / 1_000_000);
            return result;
        } catch (ToolException e) {
            return Map.of("error", e.getMessage());
        } catch (RuntimeException e) {
            log.warn("AI tool {} failed with {}", call.name(), args, e);
            return Map.of("error", "The tool failed. Answer without it.");
        }
    }

    /** Waiting between retries; replaced in tests. */
    interface Sleeper {
        Sleeper REAL = duration -> {
            try {
                Thread.sleep(duration);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
        };

        // Pauses for the given time.
        void sleep(Duration duration);
    }

    /**
     * Tries the configured models in order. Once a model answers it stays first for the rest of the
     * request, so its thought signatures go back to the same model.
     */
    private final class ModelPicker {
        private final List<String> models;
        private int current;

        // Models in preference order.
        ModelPicker(List<String> models) {
            this.models = models == null || models.isEmpty() ? List.of("gemini-3.5-flash-lite") : models;
        }

        /**
         * First answer from the current model or the ones after it; 503 AI_UNAVAILABLE when none
         * answers. A 429 with a short retryDelay (free-tier per-minute quota) is waited out once on
         * the same model before moving on.
         */
        GeminiContent generate(GeminiRequest request) {
            GeminiException last = null;
            for (int i = current; i < models.size(); i++) {
                boolean waited = false;
                while (true) {
                    try {
                        GeminiResponse response = gemini.generate(models.get(i), request);
                        current = i;
                        return response.firstContent();
                    } catch (GeminiException e) {
                        last = e;
                        log.warn("Gemini model {} failed: {}", models.get(i), e.getMessage());
                        Duration wait = e.retryAfter();
                        if (!waited && wait != null && wait.compareTo(aiProperties.maxRetryWait()) <= 0) {
                            waited = true;
                            sleeper.sleep(wait);
                            continue;
                        }
                        break;
                    }
                }
                if (!last.retryable()) {
                    break;
                }
            }
            throw new ApiException(ErrorCode.AI_UNAVAILABLE,
                    last != null && last.retryable()
                            ? "The assistant is busy right now. Please try again in a minute."
                            : ErrorCode.AI_UNAVAILABLE.defaultMessage());
        }
    }
}
