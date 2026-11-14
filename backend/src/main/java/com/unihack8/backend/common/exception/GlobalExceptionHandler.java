package com.unihack8.backend.common.exception;

import com.unihack8.backend.common.dto.ErrorResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.ConstraintViolationException;
import java.io.IOException;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.validation.FieldError;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.async.AsyncRequestNotUsableException;
import org.springframework.web.method.annotation.HandlerMethodValidationException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

/**
 * Turns every exception thrown by a controller into the standard error JSON (PLAN 3.4).
 * Security errors raised before a controller runs are handled by the JSON entry point and
 * access-denied handler in common.security.
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    private final ErrorResponseFactory errors;

    // Uses the shared factory so all errors look the same.
    public GlobalExceptionHandler(ErrorResponseFactory errors) {
        this.errors = errors;
    }

    // Errors thrown on purpose by services (ApiException with an ErrorCode).
    @ExceptionHandler(ApiException.class)
    public ResponseEntity<ErrorResponse> handleApi(ApiException ex, HttpServletRequest request) {
        return respond(ex.code(), ex.getMessage(), null, request);
    }

    // @Valid request body failed: report each bad field.
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorResponse> handleBodyValidation(MethodArgumentNotValidException ex,
                                                              HttpServletRequest request) {
        Map<String, String> fields = new LinkedHashMap<>();
        for (FieldError error : ex.getBindingResult().getFieldErrors()) {
            fields.putIfAbsent(error.getField(), error.getDefaultMessage());
        }
        ex.getBindingResult().getGlobalErrors()
                .forEach(error -> fields.putIfAbsent(error.getObjectName(), error.getDefaultMessage()));
        return respond(ErrorCode.VALIDATION_FAILED, null, fields, request);
    }

    // Validation on @RequestParam / @PathVariable constraints failed.
    @ExceptionHandler(HandlerMethodValidationException.class)
    public ResponseEntity<ErrorResponse> handleParameterValidation(HandlerMethodValidationException ex,
                                                                   HttpServletRequest request) {
        Map<String, String> fields = new LinkedHashMap<>();
        ex.getParameterValidationResults().forEach(result -> {
            String name = result.getMethodParameter().getParameterName();
            result.getResolvableErrors()
                    .forEach(error -> fields.putIfAbsent(name != null ? name : "parameter", error.getDefaultMessage()));
        });
        return respond(ErrorCode.VALIDATION_FAILED, null, fields, request);
    }

    // Bean validation raised outside the web layer (e.g. a @Validated service).
    @ExceptionHandler(ConstraintViolationException.class)
    public ResponseEntity<ErrorResponse> handleConstraintViolation(ConstraintViolationException ex,
                                                                   HttpServletRequest request) {
        Map<String, String> fields = new LinkedHashMap<>();
        ex.getConstraintViolations().forEach(v -> {
            String path = v.getPropertyPath().toString();
            String field = path.contains(".") ? path.substring(path.lastIndexOf('.') + 1) : path;
            fields.putIfAbsent(field, v.getMessage());
        });
        return respond(ErrorCode.VALIDATION_FAILED, null, fields, request);
    }

    // Body missing or not valid JSON.
    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<ErrorResponse> handleUnreadableBody(HttpMessageNotReadableException ex,
                                                              HttpServletRequest request) {
        return respond(ErrorCode.VALIDATION_FAILED, "Request body is missing or not valid JSON.", null, request);
    }

    // Required query parameter missing.
    @ExceptionHandler(MissingServletRequestParameterException.class)
    public ResponseEntity<ErrorResponse> handleMissingParameter(MissingServletRequestParameterException ex,
                                                                HttpServletRequest request) {
        return respond(ErrorCode.VALIDATION_FAILED, null,
                Map.of(ex.getParameterName(), "is required"), request);
    }

    // Parameter has the wrong type, e.g. a non-UUID id.
    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<ErrorResponse> handleTypeMismatch(MethodArgumentTypeMismatchException ex,
                                                            HttpServletRequest request) {
        return respond(ErrorCode.VALIDATION_FAILED, null,
                Map.of(ex.getName(), "has an invalid value"), request);
    }

    // No endpoint at this path.
    @ExceptionHandler(NoResourceFoundException.class)
    public ResponseEntity<ErrorResponse> handleNoEndpoint(NoResourceFoundException ex, HttpServletRequest request) {
        return respond(ErrorCode.NOT_FOUND, "No endpoint at this path.", null, request);
    }

    // Endpoint exists but not for this HTTP method.
    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    public ResponseEntity<ErrorResponse> handleWrongMethod(HttpRequestMethodNotSupportedException ex,
                                                           HttpServletRequest request) {
        return respond(ErrorCode.METHOD_NOT_ALLOWED, null, null, request);
    }

    // Method-level security (@PreAuthorize) refused the call.
    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ErrorResponse> handleAccessDenied(AccessDeniedException ex, HttpServletRequest request) {
        return respond(ErrorCode.FORBIDDEN, null, null, request);
    }

    // Anything unexpected: log it, never leak internals to the client.
    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> handleUnexpected(Exception ex, HttpServletRequest request) {
        if (isClientDisconnect(ex)) {
            // The app cancelled the request (e.g. the map moved and a newer /places call replaced it).
            // Nobody is listening, so write nothing and keep it out of the error log.
            log.debug("Client disconnected during {} {}: {}", request.getMethod(), request.getRequestURI(),
                    rootMessage(ex));
            return null;
        }
        log.error("Unhandled error on {} {}", request.getMethod(), request.getRequestURI(), ex);
        return respond(ErrorCode.INTERNAL_ERROR, null, null, request);
    }

    // True when the error only means the client hung up mid-response (abort, reset, broken pipe).
    static boolean isClientDisconnect(Throwable ex) {
        for (Throwable t = ex; t != null; t = t.getCause() == t ? null : t.getCause()) {
            if (t instanceof AsyncRequestNotUsableException
                    || "ClientAbortException".equals(t.getClass().getSimpleName())) {
                return true;
            }
            if (t instanceof IOException && t.getMessage() != null) {
                String msg = t.getMessage().toLowerCase(Locale.ROOT);
                if (msg.contains("connection reset") || msg.contains("broken pipe")
                        || msg.contains("connection was aborted") || msg.contains("connection abort")) {
                    return true;
                }
            }
        }
        return false;
    }

    // Message of the deepest cause, for a one-line debug log.
    private static String rootMessage(Throwable ex) {
        Throwable t = ex;
        while (t.getCause() != null && t.getCause() != t) {
            t = t.getCause();
        }
        return t.getClass().getSimpleName() + ": " + t.getMessage();
    }

    // Builds the response entity with the code's HTTP status.
    private ResponseEntity<ErrorResponse> respond(ErrorCode code, String message, Map<String, String> fields,
                                                  HttpServletRequest request) {
        ErrorResponse body = errors.create(code, message, fields, request.getRequestURI());
        return ResponseEntity.status(code.status()).body(body);
    }
}
