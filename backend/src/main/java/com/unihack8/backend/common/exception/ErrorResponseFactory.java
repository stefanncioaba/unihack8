package com.unihack8.backend.common.exception;

import com.unihack8.backend.common.dto.ErrorResponse;
import java.time.Clock;
import java.time.Instant;
import java.util.Map;
import org.springframework.stereotype.Component;

/** Builds ErrorResponse objects, so the controller advice and security handlers stay identical. */
@Component
public class ErrorResponseFactory {

    private final Clock clock;

    // Uses the shared clock so timestamps are testable.
    public ErrorResponseFactory(Clock clock) {
        this.clock = clock;
    }

    // Error with the code's status and the given message (default message when null).
    public ErrorResponse create(ErrorCode code, String message, String path) {
        return create(code, message, null, path);
    }

    // Same, with per-field validation problems.
    public ErrorResponse create(ErrorCode code, String message, Map<String, String> fields, String path) {
        return new ErrorResponse(
                code.status().value(),
                code.name(),
                message != null ? message : code.defaultMessage(),
                fields == null || fields.isEmpty() ? null : fields,
                Instant.now(clock),
                path);
    }
}
