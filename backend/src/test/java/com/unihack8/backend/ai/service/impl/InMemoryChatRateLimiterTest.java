package com.unihack8.backend.ai.service.impl;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.unihack8.backend.ai.config.AiProperties;
import com.unihack8.backend.common.exception.ApiException;
import com.unihack8.backend.common.exception.ErrorCode;
import com.unihack8.backend.support.MutableClock;
import java.time.Duration;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.Test;

/** 10 chat requests per user per minute (docs/API.md), then 429 RATE_LIMITED. */
class InMemoryChatRateLimiterTest {

    private final MutableClock clock = new MutableClock(Instant.parse("2026-11-14T18:00:00Z"));
    private final InMemoryChatRateLimiter limiter =
            new InMemoryChatRateLimiter(new AiProperties(5, 10, 20, 15, Duration.ofSeconds(12)), clock);

    // The 11th request inside a minute is refused; a minute later it works again.
    @Test
    void slidingMinuteWindow() {
        UUID user = UUID.randomUUID();
        for (int i = 0; i < 10; i++) {
            limiter.acquire(user);
            clock.advance(Duration.ofSeconds(1));
        }
        assertThatThrownBy(() -> limiter.acquire(user))
                .isInstanceOfSatisfying(ApiException.class, e -> org.assertj.core.api.Assertions
                        .assertThat(e.code()).isEqualTo(ErrorCode.RATE_LIMITED));
        clock.advance(Duration.ofSeconds(51));
        assertThatCode(() -> limiter.acquire(user)).doesNotThrowAnyException();
    }

    // Each user has their own counter.
    @Test
    void perUser() {
        UUID first = UUID.randomUUID();
        for (int i = 0; i < 10; i++) {
            limiter.acquire(first);
        }
        assertThatCode(() -> limiter.acquire(UUID.randomUUID())).doesNotThrowAnyException();
    }
}
