package com.unihack8.backend.ai.config;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * AI assistant limits (prefix "ai").
 *
 * @param maxToolRounds      how many times the model may call tools before it must answer
 * @param requestsPerMinute  chat requests allowed per user per minute (docs/API.md: 10)
 * @param maxMessages        conversation length kept (oldest dropped first)
 * @param toolTimeoutSeconds how long one tool call may run
 * @param maxRetryWait       longest wait accepted when Gemini says "retry in N s" (free-tier per-minute quota)
 */
@ConfigurationProperties(prefix = "ai")
public record AiProperties(
        @DefaultValue("5") int maxToolRounds,
        @DefaultValue("10") int requestsPerMinute,
        @DefaultValue("20") int maxMessages,
        @DefaultValue("15") int toolTimeoutSeconds,
        @DefaultValue("12s") Duration maxRetryWait) {
}
