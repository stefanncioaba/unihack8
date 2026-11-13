package com.unihack8.backend.ai.domain.gemini;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.Map;

/** The model asking us to run one of our tools. id must be echoed in the matching response. */
@JsonInclude(JsonInclude.Include.NON_NULL)
@JsonIgnoreProperties(ignoreUnknown = true)
public record GeminiFunctionCall(String id, String name, Map<String, Object> args) {
}
