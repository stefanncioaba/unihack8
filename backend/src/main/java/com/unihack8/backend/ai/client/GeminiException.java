package com.unihack8.backend.ai.client;

import java.time.Duration;

/**
 * Gemini did not answer. retryable = the model was busy or over quota (429/5xx/timeout), so
 * another model may still work.
 */
public class GeminiException extends RuntimeException {

    private final boolean retryable;
    private final Duration retryAfter;

    // Error with its cause and whether trying another model makes sense.
    public GeminiException(String message, boolean retryable, Throwable cause) {
        this(message, retryable, null, cause);
    }

    // Error with the wait Gemini asked for before retrying (from a 429 answer), or null.
    public GeminiException(String message, boolean retryable, Duration retryAfter, Throwable cause) {
        super(message, cause);
        this.retryable = retryable;
        this.retryAfter = retryAfter;
    }

    // How long Gemini asked us to wait before retrying the same model, or null when it did not say.
    public Duration retryAfter() {
        return retryAfter;
    }

    // True when another model (or a later retry) may succeed.
    public boolean retryable() {
        return retryable;
    }
}
