package com.unihack8.backend.ai.service.impl;

import com.unihack8.backend.ai.config.AiProperties;
import com.unihack8.backend.ai.service.ChatRateLimiter;
import com.unihack8.backend.common.exception.ApiException;
import com.unihack8.backend.common.exception.ErrorCode;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.stereotype.Component;

/**
 * Sliding one-minute window per user, kept in memory (one backend instance for the demo, so this
 * is enough; a restart simply resets the counters).
 */
@Component
public class InMemoryChatRateLimiter implements ChatRateLimiter {

    private static final Duration WINDOW = Duration.ofMinutes(1);

    private final Map<UUID, Deque<Instant>> requests = new ConcurrentHashMap<>();
    private final AiProperties properties;
    private final Clock clock;

    // Needs the limit from AiProperties and a clock (fixed in tests).
    public InMemoryChatRateLimiter(AiProperties properties, Clock clock) {
        this.properties = properties;
        this.clock = clock;
    }

    // Drops requests older than a minute, then counts this one or answers 429.
    @Override
    public void acquire(UUID userId) {
        Instant now = clock.instant();
        Deque<Instant> times = requests.computeIfAbsent(userId, id -> new ArrayDeque<>());
        synchronized (times) {
            while (!times.isEmpty() && !times.peekFirst().isAfter(now.minus(WINDOW))) {
                times.pollFirst();
            }
            if (times.size() >= properties.requestsPerMinute()) {
                throw new ApiException(ErrorCode.RATE_LIMITED);
            }
            times.addLast(now);
        }
    }
}
