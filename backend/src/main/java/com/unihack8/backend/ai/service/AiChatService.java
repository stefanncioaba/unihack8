package com.unihack8.backend.ai.service;

import com.unihack8.backend.ai.domain.dto.ChatRequest;
import com.unihack8.backend.ai.domain.dto.ChatResponse;
import java.util.UUID;

/** The AI assistant (PLAN task 11). Nothing is stored: every request carries the whole conversation. */
public interface AiChatService {

    // Answers the last user message using Gemini and our tools; 503 when Gemini fails.
    ChatResponse chat(UUID userId, ChatRequest request);
}
