package com.unihack8.backend.common.exception;

/**
 * Throw this from services to answer with a specific error code, e.g.
 * {@code throw new ApiException(ErrorCode.EVENT_FULL);}. The global handler turns it into the
 * standard error JSON.
 */
public class ApiException extends RuntimeException {

    private final ErrorCode code;

    // Error with the code's default message.
    public ApiException(ErrorCode code) {
        this(code, code.defaultMessage());
    }

    // Error with a custom, user-readable message.
    public ApiException(ErrorCode code, String message) {
        super(message);
        this.code = code;
    }

    // Shortcut for the common "this thing does not exist" case.
    public static ApiException notFound(String what) {
        return new ApiException(ErrorCode.NOT_FOUND, what + " not found.");
    }

    // The error code (and so the HTTP status) to answer with.
    public ErrorCode code() {
        return code;
    }
}
