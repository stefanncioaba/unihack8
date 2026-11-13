package com.unihack8.backend.ai.client;

import com.unihack8.backend.ai.domain.gemini.GeminiRequest;
import com.unihack8.backend.ai.domain.gemini.GeminiResponse;

/** Calls the Gemini API. Tests replace it with a fake (PLAN 11.6). */
public interface GeminiClient {

    // One generateContent call; throws GeminiException when the model does not answer.
    GeminiResponse generate(String model, GeminiRequest request);
}
