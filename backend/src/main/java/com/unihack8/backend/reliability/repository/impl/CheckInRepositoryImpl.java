package com.unihack8.backend.reliability.repository.impl;

import com.unihack8.backend.events.domain.entity.EventParticipant;
import com.unihack8.backend.reliability.domain.entity.OverdueParticipant;
import com.unihack8.backend.reliability.domain.entity.ReliabilityLogEntry;
import com.unihack8.backend.reliability.repository.CheckInRepository;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

/**
 * JdbcTemplate implementation over event_participants, events and reliability_log (same style as
 * the events feature's repositories). Status changes are conditional on JOINED, so a double scan or a
 * second no-show run changes nothing.
 */
@Repository
public class CheckInRepositoryImpl implements CheckInRepository {

    private final JdbcTemplate jdbc;

    // Uses the transaction-bound connection supplied by Spring.
    public CheckInRepositoryImpl(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    // One ticket by its unique QR token.
    @Override
    public Optional<EventParticipant> findByToken(UUID qrToken) {
        return jdbc.query("SELECT event_id, user_id, status, qr_token, joined_at, checked_in_at "
                        + "FROM event_participants WHERE qr_token = ?",
                (rs, n) -> new EventParticipant(rs.getObject("event_id", UUID.class), rs.getObject("user_id", UUID.class),
                        rs.getString("status"), rs.getObject("qr_token", UUID.class),
                        instant(rs, "joined_at"), instant(rs, "checked_in_at")),
                qrToken).stream().findFirst();
    }

    // Sets ATTENDED and checked_in_at together (the table requires both or neither).
    @Override
    public int markAttended(UUID eventId, UUID userId, Instant checkedInAt) {
        return jdbc.update("UPDATE event_participants SET status = 'ATTENDED', checked_in_at = ? "
                + "WHERE event_id = ? AND user_id = ? AND status = 'JOINED'",
                Timestamp.from(checkedInAt), eventId, userId);
    }

    // Started user events only; whether they are over is decided in Java (end or start + 3 h).
    @Override
    public List<OverdueParticipant> joinedInStartedEvents(Instant now) {
        return jdbc.query("SELECT p.event_id, p.user_id, e.starts_at, e.ends_at FROM event_participants p "
                        + "JOIN events e ON e.id = p.event_id "
                        + "WHERE p.status = 'JOINED' AND e.source = 'USER' AND e.starts_at <= ? "
                        + "ORDER BY e.starts_at, p.event_id, p.user_id",
                (rs, n) -> new OverdueParticipant(rs.getObject("event_id", UUID.class),
                        rs.getObject("user_id", UUID.class), instant(rs, "starts_at"), instant(rs, "ends_at")),
                Timestamp.from(now));
    }

    // Sets NO_SHOW only if still JOINED.
    @Override
    public int markNoShow(UUID eventId, UUID userId) {
        return jdbc.update("UPDATE event_participants SET status = 'NO_SHOW' "
                + "WHERE event_id = ? AND user_id = ? AND status = 'JOINED'", eventId, userId);
    }

    // Newest first; events deleted later keep their log rows with event_id = null.
    @Override
    public List<ReliabilityLogEntry> recentLog(UUID userId, int limit) {
        return jdbc.query("SELECT l.points_change, l.reason, l.event_id, e.title, l.created_at "
                        + "FROM reliability_log l LEFT JOIN events e ON e.id = l.event_id "
                        + "WHERE l.user_id = ? ORDER BY l.created_at DESC, l.id LIMIT ?",
                (rs, n) -> new ReliabilityLogEntry(rs.getInt("points_change"), rs.getString("reason"),
                        rs.getObject("event_id", UUID.class), rs.getString("title"), instant(rs, "created_at")),
                userId, limit);
    }

    // Nullable timestamp column as an Instant.
    private static Instant instant(ResultSet rs, String column) throws SQLException {
        Timestamp value = rs.getTimestamp(column);
        return value == null ? null : value.toInstant();
    }
}
