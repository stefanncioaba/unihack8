package com.unihack8.backend.ai.domain.gemini;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;

/**
 * One piece of a message: text, a function call or a function response.
 * thoughtSignature must be sent back unchanged with the model parts it came with (Gemini 3 needs
 * it for function calling); thought = true marks private reasoning, never shown to users.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
@JsonIgnoreProperties(ignoreUnknown = true)
public record GeminiPart(
        String text,
        Boolean thought,
        String thoughtSignature,
        GeminiFunctionCall functionCall,
        GeminiFunctionResponse functionResponse) {

    // Plain text part.
    public static GeminiPart text(String text) {
        return new GeminiPart(text, null, null, null, null);
    }

    // Function call part (used by tests and fakes).
    public static GeminiPart functionCall(GeminiFunctionCall call) {
        return new GeminiPart(null, null, null, call, null);
    }

    // Function response part for a tool result.
    public static GeminiPart functionResponse(GeminiFunctionResponse response) {
        return new GeminiPart(null, null, null, null, response);
    }

    // Visible answer text (not reasoning), or null.
    public String visibleText() {
        return Boolean.TRUE.equals(thought) ? null : text;
    }
}
