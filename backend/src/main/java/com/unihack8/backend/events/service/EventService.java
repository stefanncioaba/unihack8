package com.unihack8.backend.events.service;

import com.unihack8.backend.common.dto.PageResponse;
import com.unihack8.backend.events.domain.dto.*;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** Event lifecycle and participation rules. */
public interface EventService {
    // Searches public events with optional filters.
    PageResponse<EventSummary> search(String q, List<String> category, Instant from, Instant to,
            String bbox, String source, Integer page, Integer size);

    // Reads detail and optional caller status.
    EventDetail detail(UUID id, Optional<UUID> caller);

    // Creates a user event owned by the caller.
    EventDetail create(UUID caller, CreateEventRequest request);

    // Updates an organizer-owned event.
    EventDetail update(UUID id, UUID caller, UpdateEventRequest request);

    // Removes an organizer-owned event.
    void delete(UUID id, UUID caller);

    // Takes one available spot and issues a stable ticket.
    JoinResponse join(UUID id, UUID caller);

    // Leaves an event and applies any late-cancel penalty.
    LeaveResponse leave(UUID id, UUID caller);

    // Shows event participants and their reliability.
    List<ParticipantResponse> participants(UUID id);

    // Bans a participant from an organizer-owned event.
    BanResponse ban(UUID id, UUID organizer, UUID userId);

    // Lists the caller's joined and created events.
    MyEventsResponse mine(UUID caller);
}
