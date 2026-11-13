package com.unihack8.backend.ai.domain.dto;

import com.unihack8.backend.events.domain.dto.EventSummary;
import com.unihack8.backend.places.domain.dto.PlaceSummaryDto;
import java.util.List;

/**
 * POST /ai/chat answer (PLAN 11.1, 11.5).
 *
 * @param reply   the answer text (plain text, no markdown)
 * @param places  places named in the reply, in the order they appear, for cards and "show on map"
 * @param events  events named in the reply, in the order they appear
 * @param sources pages the quoted prices came from
 */
public record ChatResponse(String reply, List<PlaceSummaryDto> places, List<EventSummary> events,
                           List<SourceDto> sources) {
}
