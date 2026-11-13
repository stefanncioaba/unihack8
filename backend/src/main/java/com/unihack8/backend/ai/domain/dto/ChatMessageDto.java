package com.unihack8.backend.ai.domain.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * One message of the conversation the app sends (docs/API.md -> POST /ai/chat).
 *
 * @param role    "user" or "assistant"
 * @param content message text, at most 2000 characters
 */
public record ChatMessageDto(
        @NotBlank @Pattern(regexp = "user|assistant", message = "must be user or assistant") String role,
        @NotBlank @Size(max = 2000) String content) {
}
