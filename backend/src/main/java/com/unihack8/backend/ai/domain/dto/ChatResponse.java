package com.unihack8.backend.ai.domain.dto;

import com.unihack8.backend.events.domain.dto.EventSummary;
import com.unihack8.backend.places.domain.dto.PlaceSummaryDto;
import java.util.List;

/**
 * POST /ai/chat answer (PLAN 11.1, 11.5, 18.1).
 *
 * @param reply   the answer text (plain text, no markdown)
 * @param places  places named in the reply, in the order they appear, for cards and "show on map"
 * @param events  events named in the reply, in the order they appear
 * @param sources pages the quoted prices came from
 * @param routes  routes plan_route planned for this answer, for route cards and the "Go" button
 * @param cost    average cost of what the answer recommends, from stored prices only; null when none applies
 */
public record ChatResponse(String reply, List<PlaceSummaryDto> places, List<EventSummary> events,
                           List<SourceDto> sources, List<ChatRouteDto> routes, ChatCostDto cost) {
}
