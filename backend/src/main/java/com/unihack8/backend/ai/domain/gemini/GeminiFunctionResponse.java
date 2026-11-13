package com.unihack8.backend.ai.domain.gemini;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.Map;

/** A tool result sent back to the model; id and name match the GeminiFunctionCall. */
@JsonInclude(JsonInclude.Include.NON_NULL)
@JsonIgnoreProperties(ignoreUnknown = true)
public record GeminiFunctionResponse(String id, String name, Map<String, Object> response) {
}
