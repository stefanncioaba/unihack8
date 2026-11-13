package com.unihack8.backend.ai.client.impl;

import com.unihack8.backend.ai.client.GeminiClient;
import com.unihack8.backend.ai.client.GeminiException;
import com.unihack8.backend.ai.config.GeminiProperties;
import com.unihack8.backend.ai.domain.gemini.GeminiRequest;
import com.unihack8.backend.ai.domain.gemini.GeminiResponse;
import java.time.Duration;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;
import tools.jackson.databind.json.JsonMapper;

/** Gemini REST API client (v1beta generateContent); the key goes in the x-goog-api-key header. */
@Component
public class GeminiRestClient implements GeminiClient {

    static final String GENERATE_PATH = "/v1beta/models/{model}:generateContent";

    private static final Pattern RETRY_DELAY = Pattern.compile("\"retryDelay\"\\s*:\\s*\"(\\d+(?:\\.\\d+)?)s\"");

    // Plain JSON writer: the body is sent as bytes so it has a Content-Length.
    private static final JsonMapper JSON = JsonMapper.builder().build();

    private final RestClient restClient;
    private final GeminiProperties properties;

    // Uses the RestClient from GeminiClientConfig (base URL and timeouts already set).
    public GeminiRestClient(@Qualifier("geminiHttpClient") RestClient restClient, GeminiProperties properties) {
        this.restClient = restClient;
        this.properties = properties;
    }

    // Sends one request; 429 and 5xx (and timeouts) are retryable, other errors are not.
    @Override
    public GeminiResponse generate(String model, GeminiRequest request) {
        if (properties.apiKey() == null || properties.apiKey().isBlank()) {
            throw new GeminiException("gemini.api-key is not set", false, null);
        }
        GeminiResponse response;
        try {
            response = restClient.post()
                    .uri(GENERATE_PATH, model)
                    .header("x-goog-api-key", properties.apiKey())
                    .contentType(MediaType.APPLICATION_JSON)
                    .accept(MediaType.APPLICATION_JSON)
                    .body(JSON.writeValueAsBytes(request))
                    .retrieve()
                    .body(GeminiResponse.class);
        } catch (RestClientResponseException e) {
            int status = e.getStatusCode().value();
            boolean retryable = status == 429 || status >= 500;
            String body = e.getResponseBodyAsString();
            throw new GeminiException("Gemini " + model + " answered " + status + ": " + abbreviate(body),
                    retryable, status == 429 ? retryDelay(body) : null, e);
        } catch (RestClientException e) {
            throw new GeminiException("Gemini " + model + " request failed: " + e.getMessage(), true, e);
        }
        if (response == null) {
            throw new GeminiException("Gemini " + model + " sent an empty answer", true, null);
        }
        return response;
    }

    // The "retryDelay": "12s" (or "1.5s") Gemini puts in 429 answers, or null.
    static Duration retryDelay(String body) {
        if (body == null) {
            return null;
        }
        Matcher matcher = RETRY_DELAY.matcher(body);
        if (!matcher.find()) {
            return null;
        }
        return Duration.ofMillis(Math.round(Double.parseDouble(matcher.group(1)) * 1000));
    }

    // Keeps log lines short.
    static String abbreviate(String text) {
        if (text == null) {
            return "";
        }
        String oneLine = text.replaceAll("\\s+", " ");
        return oneLine.length() > 300 ? oneLine.substring(0, 300) + "..." : oneLine;
    }
}
