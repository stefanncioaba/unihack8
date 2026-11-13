package com.unihack8.backend.ai.domain.gemini;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.util.List;

/** Answer of generateContent; only the fields we use. */
@JsonIgnoreProperties(ignoreUnknown = true)
public record GeminiResponse(List<Candidate> candidates, String modelVersion) {

    /** One generated answer; content is null when the model was blocked. */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Candidate(GeminiContent content, String finishReason) {
    }

    // The first candidate's content, or null.
    public GeminiContent firstContent() {
        return candidates == null || candidates.isEmpty() ? null : candidates.getFirst().content();
    }
}
