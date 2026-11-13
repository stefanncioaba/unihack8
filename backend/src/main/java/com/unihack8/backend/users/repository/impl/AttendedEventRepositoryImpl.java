package com.unihack8.backend.users.repository.impl;

import com.unihack8.backend.users.domain.dto.AttendedEventResponse;
import com.unihack8.backend.users.repository.AttendedEventRepository;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public class AttendedEventRepositoryImpl implements AttendedEventRepository {
    private static final String ATTENDED_EVENTS_SQL = """
            SELECT e.id, e.title, e.starts_at
            FROM events e
            JOIN event_participants ep ON ep.event_id = e.id
            WHERE ep.user_id = ? AND ep.status = 'ATTENDED'
            ORDER BY e.starts_at DESC
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
                (rs, rowNum) -> new AttendedEventResponse(
                        rs.getObject("id", UUID.class),
                        rs.getString("title"),
                        rs.getTimestamp("starts_at").toInstant()),
                userId);
    }
}
