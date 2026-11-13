package com.unihack8.backend.eventimport.client.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.util.List;

/** Body of GET /public/event-search: {@code {"events": {"items": [...], "hasMorePages": false}}}. */
@JsonIgnoreProperties(ignoreUnknown = true)
public record LiveTicketsSearchResponse(Page events) {

    // Events on this page; empty when the body had none.
    public List<LiveTicketsEvent> items() {
        return events == null || events.items() == null ? List.of() : events.items();
    }

    // True when LiveTickets says another page follows.
    public boolean hasMorePages() {
        return events != null && Boolean.TRUE.equals(events.hasMorePages());
    }

    /** The "events" object of the response. */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Page(List<LiveTicketsEvent> items, Long totalItems, Boolean hasMorePages) {
    }
}
