package com.unihack8.backend.ai.controller;

import com.unihack8.backend.ai.domain.dto.ChatRequest;
import com.unihack8.backend.ai.domain.dto.ChatResponse;
import com.unihack8.backend.ai.service.AiChatService;
import com.unihack8.backend.common.security.CurrentUser;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** POST /ai/chat (PLAN 11.1, docs/API.md -> AI assistant). Needs a token. */
@RestController
@RequestMapping("/ai")
public class AiController {

    private final AiChatService chatService;
    private final CurrentUser currentUser;

    // Needs the chat service and the signed-in user helper.
    public AiController(AiChatService chatService, CurrentUser currentUser) {
        this.chatService = chatService;
        this.currentUser = currentUser;
    }

    // Answers the conversation's last user message.
    @PostMapping("/chat")
    public ChatResponse chat(@Valid @RequestBody ChatRequest request) {
        return chatService.chat(currentUser.id(), request);
    }
}
