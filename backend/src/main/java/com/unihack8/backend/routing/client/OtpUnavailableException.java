package com.unihack8.backend.routing.client;

/** OpenTripPlanner did not answer, timed out, or answered with an error. */
public class OtpUnavailableException extends RuntimeException {

    // Wraps the underlying cause (connection refused, timeout, GraphQL error...).
    public OtpUnavailableException(String message, Throwable cause) {
        super(message, cause);
    }
}
