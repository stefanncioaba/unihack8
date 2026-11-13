package com.unihack8.backend.eventimport.client;

import com.unihack8.backend.eventimport.client.dto.LiveTicketsEvent;
import java.util.List;

/** Reads upcoming events from LiveTickets' public event search (PLAN 7.1). */
public interface LiveTicketsClient {

    // Every upcoming event LiveTickets lists (all cities; filtering happens in the mapper).
    List<LiveTicketsEvent> fetchUpcomingEvents();
}
