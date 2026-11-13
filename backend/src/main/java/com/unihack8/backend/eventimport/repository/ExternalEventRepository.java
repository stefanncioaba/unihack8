package com.unihack8.backend.eventimport.repository;

import com.unihack8.backend.common.geo.GeoPoint;
import com.unihack8.backend.eventimport.domain.dto.ImportedEvent;
import java.time.Instant;
import java.util.Collection;
import java.util.Map;

/**
 * Writes imported events into the events table (source = EXTERNAL) with plain SQL, so the import
 * does not depend on the events feature's JPA entity (PLAN task 5 is built in parallel).
 */
public interface ExternalEventRepository {

    // For each of these external ids that is already stored: whether it has coordinates.
    Map<String, Boolean> findExisting(Collection<String> externalIds);

    // Inserts a new external event; location may be null (event then has no coordinates).
    void insert(ImportedEvent event, GeoPoint location);

    // Refreshes an existing event's details; its coordinates are only replaced when location is given.
    void update(ImportedEvent event, GeoPoint location);

    // Deletes imported events with this id prefix that start after `now` and are not in keepIds.
    int deleteUpcomingNotIn(String externalIdPrefix, Collection<String> keepIds, Instant now);
}
