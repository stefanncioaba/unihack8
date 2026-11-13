package com.unihack8.backend.ai.config;

import java.time.Duration;
import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * Gemini API settings (prefix "gemini"), see application-local.properties.example.
 *
 * @param apiKey         Google AI Studio key (backend only, never in the app)
 * @param baseUrl        Gemini REST API root
 * @param chatModels     free-tier models to try in order; the next one is used when one is busy (429/503)
 * @param connectTimeout how long to wait for a connection
 * @param readTimeout    how long to wait for one model answer
 */
@ConfigurationProperties(prefix = "gemini")
public record GeminiProperties(
        String apiKey,
        @DefaultValue("https://generativelanguage.googleapis.com") String baseUrl,
        @DefaultValue({"gemini-3.5-flash-lite", "gemini-3.5-flash"}) List<String> chatModels,
        @DefaultValue("5s") Duration connectTimeout,
        @DefaultValue("40s") Duration readTimeout) {
}
