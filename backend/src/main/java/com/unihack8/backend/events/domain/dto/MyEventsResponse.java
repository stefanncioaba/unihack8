package com.unihack8.backend.events.domain.dto;

import java.util.List;

/** Joined and organized event lists for the current user. */
public record MyEventsResponse(List<JoinedEvent> joined, List<EventSummary> organizing) {
    /** An event with the caller's participation status. */
    public record JoinedEvent(EventSummary event, String status) {
    }
}
