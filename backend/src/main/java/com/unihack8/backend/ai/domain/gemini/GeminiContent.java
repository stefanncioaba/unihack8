package com.unihack8.backend.ai.domain.gemini;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.List;

/** One conversation turn; role is "user" or "model" (tool results are sent as "user"). */
@JsonInclude(JsonInclude.Include.NON_NULL)
@JsonIgnoreProperties(ignoreUnknown = true)
public record GeminiContent(String role, List<GeminiPart> parts) {

    // Turn made of one text part.
    public static GeminiContent text(String role, String text) {
        return new GeminiContent(role, List.of(GeminiPart.text(text)));
    }
}
