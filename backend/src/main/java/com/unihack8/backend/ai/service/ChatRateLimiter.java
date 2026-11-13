package com.unihack8.backend.ai.service;

import java.util.UUID;

/** Limits AI chat requests per user (docs/API.md: 10 per minute, then 429 RATE_LIMITED). */
public interface ChatRateLimiter {

    // Counts one request; throws ApiException(RATE_LIMITED) when the user is over the limit.
    void acquire(UUID userId);
}
