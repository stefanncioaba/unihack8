package com.unihack8.backend.eventimport.mapper;

import com.unihack8.backend.eventimport.client.dto.LiveTicketsEvent;
import com.unihack8.backend.eventimport.domain.dto.ImportedEvent;
import java.util.Optional;

/** Turns LiveTickets events into rows for our events table (PLAN 7.2). */
public interface LiveTicketsEventMapper {

    // The event as we store it, or empty when it is in another city or misses required data.
    Optional<ImportedEvent> toImportedEvent(LiveTicketsEvent event);
}
