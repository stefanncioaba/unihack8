package com.unihack8.backend.eventimport.repository.impl;

import com.unihack8.backend.common.geo.GeoPoint;
import com.unihack8.backend.eventimport.domain.dto.ImportedEvent;
import com.unihack8.backend.eventimport.repository.ExternalEventRepository;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/**
 * JdbcTemplate implementation over public.events (migration 20261113000002_events.sql). Only
 * columns of EXTERNAL events are written: organizer_id and capacity stay null.
 */
@Repository
public class ExternalEventRepositoryImpl implements ExternalEventRepository {

    private static final String SOURCE = "EXTERNAL";

    private final JdbcTemplate jdbc;

    // Uses the application's database connection.
    public ExternalEventRepositoryImpl(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    // One query with an IN list; returns externalId -> has coordinates.
    @Override
    public Map<String, Boolean> findExisting(Collection<String> externalIds) {
        Map<String, Boolean> existing = new HashMap<>();
        if (externalIds.isEmpty()) {
            return existing;
        }
        String placeholders = String.join(",", java.util.Collections.nCopies(externalIds.size(), "?"));
        jdbc.query("SELECT external_id, lat FROM events WHERE source = ? AND external_id IN (" + placeholders + ")",
                rs -> {
                    existing.put(rs.getString("external_id"), rs.getObject("lat") != null);
                },
                concat(SOURCE, externalIds));
        return existing;
    }

    // INSERT with a new UUID; lat/lon both null when the venue was not located.
    @Override
    public void insert(ImportedEvent event, GeoPoint location) {
        jdbc.update("""
                INSERT INTO events (id, source, external_id, title, description, category, venue_name,
                                    lat, lon, starts_at, ends_at, image_url, price_min, price_max, external_url)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                UUID.randomUUID(), SOURCE, event.externalId(), event.title(), event.description(),
                event.category(), event.venueName(),
                location == null ? null : location.lat(), location == null ? null : location.lon(),
                utc(event.startsAt()), utc(event.endsAt()), event.imageUrl(),
                event.priceMin(), event.priceMax(), event.externalUrl());
    }

    // UPDATE of the details; coordinates only when a new location is given.
    @Override
    public void update(ImportedEvent event, GeoPoint location) {
        String coordinates = location == null ? "" : ", lat = ?, lon = ?";
        List<Object> args = new ArrayList<>(List.of(event.title()));
        args.add(event.description());
        args.add(event.category());
        args.add(event.venueName());
        args.add(utc(event.startsAt()));
        args.add(utc(event.endsAt()));
        args.add(event.imageUrl());
        args.add(event.priceMin());
        args.add(event.priceMax());
        args.add(event.externalUrl());
        if (location != null) {
            args.add(location.lat());
            args.add(location.lon());
        }
        args.add(SOURCE);
        args.add(event.externalId());
        jdbc.update("UPDATE events SET title = ?, description = ?, category = ?, venue_name = ?, starts_at = ?, "
                + "ends_at = ?, image_url = ?, price_min = ?, price_max = ?, external_url = ?" + coordinates
                + " WHERE source = ? AND external_id = ?", args.toArray());
    }

    // Removes future events that LiveTickets no longer lists (cancelled or moved); past ones are kept.
    @Override
    public int deleteUpcomingNotIn(String externalIdPrefix, Collection<String> keepIds, Instant now) {
        List<Object> args = new ArrayList<>(List.of(SOURCE, externalIdPrefix + "%", utc(now)));
        String notIn = "";
        if (!keepIds.isEmpty()) {
            notIn = " AND external_id NOT IN (" + String.join(",", java.util.Collections.nCopies(keepIds.size(), "?")) + ")";
            args.addAll(keepIds);
        }
        return jdbc.update("DELETE FROM events WHERE source = ? AND external_id LIKE ? AND starts_at > ?" + notIn,
                args.toArray());
    }

    // Instant as a UTC timestamp-with-time-zone value (works on PostgreSQL and H2).
    private static OffsetDateTime utc(Instant instant) {
        return instant == null ? null : instant.atOffset(ZoneOffset.UTC);
    }

    // First value followed by the collection's values, as JDBC arguments.
    private static Object[] concat(Object first, Collection<String> rest) {
        List<Object> all = new ArrayList<>(rest.size() + 1);
        all.add(first);
        all.addAll(rest);
        return all.toArray();
    }
}
