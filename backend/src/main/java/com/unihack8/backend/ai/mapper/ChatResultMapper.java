package com.unihack8.backend.ai.mapper;

import com.unihack8.backend.ai.domain.ToolContext;
import com.unihack8.backend.ai.domain.dto.ChatResponse;

/** Builds the POST /ai/chat answer from the model reply and what the tools returned (PLAN 11.5). */
public interface ChatResultMapper {

    // Reply without markdown, plus the places/events it names and the sources of quoted prices.
    ChatResponse toResponse(String modelReply, ToolContext context);
}
