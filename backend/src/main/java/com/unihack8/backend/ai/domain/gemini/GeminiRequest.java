package com.unihack8.backend.ai.domain.gemini;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.List;
import java.util.Map;

/**
 * Body of POST /v1beta/models/{model}:generateContent.
 *
 * @param tools      [{ functionDeclarations: [...] }]
 * @param toolConfig { functionCallingConfig: { mode: AUTO | NONE } }; NONE forces a text answer
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record GeminiRequest(
        GeminiContent systemInstruction,
        List<GeminiContent> contents,
        List<Map<String, Object>> tools,
        Map<String, Object> toolConfig) {
}
