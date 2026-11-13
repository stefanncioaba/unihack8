package com.unihack8.backend.ai.client.impl;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.sun.net.httpserver.HttpServer;
import com.unihack8.backend.ai.client.GeminiException;
import com.unihack8.backend.ai.config.GeminiClientConfig;
import com.unihack8.backend.ai.config.GeminiProperties;
import com.unihack8.backend.ai.domain.gemini.GeminiContent;
import com.unihack8.backend.ai.domain.gemini.GeminiPart;
import com.unihack8.backend.ai.domain.gemini.GeminiRequest;
import com.unihack8.backend.ai.domain.gemini.GeminiResponse;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

/** The real HTTP client against a local fake Gemini server (no network, no quota used). */
class GeminiRestClientTest {

    private HttpServer server;

    // Stops the fake server after each test.
    @AfterEach
    void stop() {
        if (server != null) {
            server.stop(0);
        }
    }

    // Sends the key header and JSON body; reads text, function calls and thought signatures.
    @Test
    void success() throws IOException {
        AtomicReference<String> key = new AtomicReference<>();
        AtomicReference<String> body = new AtomicReference<>();
        AtomicReference<String> path = new AtomicReference<>();
        String answer = """
                {"candidates":[{"content":{"role":"model","parts":[
                  {"functionCall":{"id":"call-9","name":"search_places","args":{"categories":["cafe"],"limit":3}},
                   "thoughtSignature":"c2ln"},
                  {"text":"thinking","thought":true}]},"finishReason":"STOP"}],
                 "usageMetadata":{"totalTokenCount":42},"modelVersion":"gemini-3.5-flash-lite"}""";
        GeminiRestClient client = client(200, answer, key, body, path, "secret-key");

        GeminiResponse response = client.generate("gemini-3.5-flash-lite", new GeminiRequest(
                GeminiContent.text(null, "system"), List.of(GeminiContent.text("user", "coffee?")),
                List.of(Map.of("functionDeclarations", List.of())), Map.of("functionCallingConfig", Map.of("mode", "AUTO"))));

        assertThat(key.get()).isEqualTo("secret-key");
        assertThat(path.get()).isEqualTo("/v1beta/models/gemini-3.5-flash-lite:generateContent");
        assertThat(body.get()).contains("\"systemInstruction\"").contains("\"text\":\"coffee?\"")
                .doesNotContain("\"thought\"").doesNotContain("null");
        GeminiPart call = response.firstContent().parts().getFirst();
        assertThat(call.functionCall().id()).isEqualTo("call-9");
        assertThat(call.functionCall().args()).containsEntry("limit", 3);
        assertThat(call.thoughtSignature()).isEqualTo("c2ln");
        assertThat(response.firstContent().parts().get(1).visibleText()).isNull();
    }

    // 429 is retryable and carries Gemini's retryDelay.
    @Test
    void quotaError() throws IOException {
        String error = """
                {"error":{"code":429,"status":"RESOURCE_EXHAUSTED","details":[
                  {"@type":"type.googleapis.com/google.rpc.RetryInfo","retryDelay":"7.5s"}]}}""";
        GeminiRestClient client = client(429, error, null, null, null, "k");
        assertThatThrownBy(() -> client.generate("m", request()))
                .isInstanceOfSatisfying(GeminiException.class, e -> {
                    assertThat(e.retryable()).isTrue();
                    assertThat(e.retryAfter()).isEqualTo(Duration.ofMillis(7500));
                });
    }

    // 503 is retryable; 400/404 are not.
    @Test
    void otherErrors() throws IOException {
        GeminiRestClient busy = client(503, "{\"error\":{\"code\":503}}", null, null, null, "k");
        assertThatThrownBy(() -> busy.generate("m", request()))
                .isInstanceOfSatisfying(GeminiException.class, e -> assertThat(e.retryable()).isTrue());
        stop();
        GeminiRestClient gone = client(404, "{\"error\":{\"code\":404}}", null, null, null, "k");
        assertThatThrownBy(() -> gone.generate("m", request()))
                .isInstanceOfSatisfying(GeminiException.class, e -> {
                    assertThat(e.retryable()).isFalse();
                    assertThat(e.retryAfter()).isNull();
                });
    }

    // No key configured: fails without calling anything.
    @Test
    void missingKey() {
        GeminiProperties properties = new GeminiProperties("", "http://127.0.0.1:1", List.of("m"),
                Duration.ofSeconds(1), Duration.ofSeconds(1));
        GeminiRestClient client = new GeminiRestClient(new GeminiClientConfig().geminiHttpClient(properties), properties);
        assertThatThrownBy(() -> client.generate("m", request()))
                .isInstanceOfSatisfying(GeminiException.class, e -> assertThat(e.retryable()).isFalse());
    }

    // retryDelay parsing on its own.
    @Test
    void retryDelayParsing() {
        assertThat(GeminiRestClient.retryDelay("{\"retryDelay\": \"12s\"}")).isEqualTo(Duration.ofSeconds(12));
        assertThat(GeminiRestClient.retryDelay("{}")).isNull();
        assertThat(GeminiRestClient.retryDelay(null)).isNull();
    }

    // Fake server answering every request with the given status and body, recording what it got.
    private GeminiRestClient client(int status, String response, AtomicReference<String> key,
                                    AtomicReference<String> body, AtomicReference<String> path,
                                    String apiKey) throws IOException {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/", exchange -> {
            if (key != null) {
                key.set(exchange.getRequestHeaders().getFirst("x-goog-api-key"));
            }
            if (body != null) {
                body.set(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
            }
            if (path != null) {
                path.set(exchange.getRequestURI().getPath());
            }
            byte[] bytes = response.getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().add("Content-Type", "application/json");
            exchange.sendResponseHeaders(status, bytes.length);
            exchange.getResponseBody().write(bytes);
            exchange.close();
        });
        server.start();
        GeminiProperties properties = new GeminiProperties(apiKey,
                "http://127.0.0.1:" + server.getAddress().getPort(), List.of("m"),
                Duration.ofSeconds(2), Duration.ofSeconds(5));
        return new GeminiRestClient(new GeminiClientConfig().geminiHttpClient(properties), properties);
    }

    // Minimal request.
    private static GeminiRequest request() {
        return new GeminiRequest(null, List.of(GeminiContent.text("user", "hi")), null, null);
    }
}
