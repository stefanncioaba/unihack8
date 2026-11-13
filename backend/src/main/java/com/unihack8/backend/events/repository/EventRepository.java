package com.unihack8.backend.events.repository;

import com.unihack8.backend.events.domain.dto.EventSearchCriteria;
import com.unihack8.backend.events.domain.entity.Event;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

/** Event persistence; writes are called inside service transactions. */
public interface EventRepository {
    // Searches events and computes the page total in the database.
    Page<Event> search(EventSearchCriteria criteria, Pageable page);

    // Reads one event without taking a write lock.
    Optional<Event> find(UUID id);

    // Serializes capacity and state changes on an event row.
    Optional<Event> lock(UUID id);

    // Inserts a user-created event.
    void insert(Event event);

    // Replaces editable columns of a user-created event.
    void update(Event event);

    // Deletes the event and cascades its participants.
    void delete(UUID id);

    // Lists events a user created, earliest first.
    List<Event> organizedBy(UUID userId);

    // Counts active spots, including people already checked in.
    int activeCount(UUID eventId);

    // Counts occupied spots for one page without a query per event.
    Map<UUID, Integer> activeCounts(List<UUID> eventIds);
}
