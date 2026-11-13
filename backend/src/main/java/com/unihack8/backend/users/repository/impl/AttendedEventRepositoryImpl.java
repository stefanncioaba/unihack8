package com.unihack8.backend.users.repository.impl;

import com.unihack8.backend.users.domain.dto.AttendedEventResponse;
import com.unihack8.backend.users.repository.AttendedEventRepository;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.util.List;
import java.util.UUID;

@Repository
public class AttendedEventRepositoryImpl implements AttendedEventRepository {
    // Newest first, at most 20 (docs/API.md -> GET /users/{id}). A missing category is shown as OTHER.
    // spots_left counts JOINED and ATTENDED participants, like participantCount in the event detail.
    // It is cast to INTEGER: on PostgreSQL capacity - COUNT(*) is a bigint, which cannot be read as Integer.
    private static final String ATTENDED_EVENTS_SQL = """
            SELECT e.id, e.source, e.title, COALESCE(e.category, 'OTHER') AS category, e.venue_name,
                   e.lat, e.lon, e.starts_at, e.ends_at, e.image_url, e.price_min, e.price_max, e.capacity,
                   CASE WHEN e.capacity IS NULL THEN NULL
                        ELSE CAST(GREATEST(e.capacity - (SELECT COUNT(*) FROM event_participants p
                                                         WHERE p.event_id = e.id
                                                           AND p.status IN ('JOINED', 'ATTENDED')), 0) AS INTEGER)
                   END AS spots_left
            FROM events e
            JOIN event_participants ep ON ep.event_id = e.id
            WHERE ep.user_id = ? AND ep.status = 'ATTENDED'
            ORDER BY e.starts_at DESC
            LIMIT 20
            """;

    private final JdbcTemplate jdbcTemplate;

    // Uses the event tables owned by the events track without duplicating entities.
    public AttendedEventRepositoryImpl(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    // Returns a user's attended events in newest-first order.
    @Override
    public List<AttendedEventResponse> findAttendedByUserId(UUID userId) {
        return jdbcTemplate.query(ATTENDED_EVENTS_SQL,
                (rs, rowNum) -> {
                    Timestamp endsAt = rs.getTimestamp("ends_at");
                    return new AttendedEventResponse(
                            rs.getObject("id", UUID.class),
                            rs.getString("source"),
                            rs.getString("title"),
                            rs.getString("category"),
                            rs.getString("venue_name"),
                            rs.getObject("lat", Double.class),
                            rs.getObject("lon", Double.class),
                            rs.getTimestamp("starts_at").toInstant(),
                            endsAt == null ? null : endsAt.toInstant(),
                            rs.getString("image_url"),
                            rs.getBigDecimal("price_min"),
                            rs.getBigDecimal("price_max"),
                            rs.getObject("capacity", Integer.class),
                            rs.getObject("spots_left", Integer.class));
                },
                userId);
    }
}
