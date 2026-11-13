package com.unihack8.backend.ai.domain.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import java.util.List;

/**
 * POST /ai/chat body: the whole conversation (nothing is stored on the server, PLAN 11) and the
 * optional user location (null when permission was denied).
 */
public record ChatRequest(
        @NotEmpty List<@Valid ChatMessageDto> messages,
        @Valid LocationDto location) {
}
