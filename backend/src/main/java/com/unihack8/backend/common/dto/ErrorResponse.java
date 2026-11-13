package com.unihack8.backend.common.dto;

import java.time.Instant;
import java.util.Map;

/**
 * The one error shape every endpoint returns (docs/API.md -> Error answer).
 *
 * @param status    HTTP status number
 * @param code      stable machine-readable code, see ErrorCode
 * @param message   human-readable explanation
 * @param fields    per-field problems for VALIDATION_FAILED, otherwise null
 * @param timestamp when the error happened (UTC)
 * @param path      request path that failed
 */
public record ErrorResponse(
        int status,
        String code,
        String message,
        Map<String, String> fields,
        Instant timestamp,
        String path) {
}
