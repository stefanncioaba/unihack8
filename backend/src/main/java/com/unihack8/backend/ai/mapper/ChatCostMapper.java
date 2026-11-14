package com.unihack8.backend.ai.mapper;

import com.unihack8.backend.ai.domain.ToolContext;
import com.unihack8.backend.ai.domain.dto.ChatCostDto;
import com.unihack8.backend.common.text.TextMatch;
import com.unihack8.backend.events.domain.dto.EventSummary;
import java.util.List;

/** Builds the cost box of an AI answer from the stored prices of what it recommends (docs/API.md -> AI). */
public interface ChatCostMapper {

    /**
     * Cost of the recommended places/events (in reply order), or null when none has a stored price.
     * placePositions / eventPositions are where each one is first named in TextMatch.normalize(plainReply)
     * (same order as the lists; -1 or out of range when unknown): a place's menu items are looked up in its
     * own part of the reply, up to the next recommended name.
     */
    ChatCostDto toCost(String plainReply, List<ToolContext.FoundPlace> places, List<Integer> placePositions,
                       List<EventSummary> events, List<Integer> eventPositions);

    // Same, with each position taken as the first occurrence of the name in the reply.
    default ChatCostDto toCost(String plainReply, List<ToolContext.FoundPlace> places, List<EventSummary> events) {
        String reply = TextMatch.normalize(plainReply);
        List<Integer> placePositions = places.stream()
                .map(p -> reply.indexOf(TextMatch.normalize(p.place().name()))).toList();
        List<Integer> eventPositions = events.stream().map(e -> reply.indexOf(TextMatch.normalize(e.title()))).toList();
        return toCost(plainReply, places, placePositions, events, eventPositions);
    }
}
