package com.unihack8.backend.events.repository.impl;

import com.unihack8.backend.events.domain.entity.EventParticipant;
import com.unihack8.backend.events.repository.ParticipationRepository;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Repository;

/** SQL implementation for participation and reliability writes. */
@Repository
public class ParticipationRepositoryImpl implements ParticipationRepository {
    private static final String COLUMNS = "event_id, user_id, status, qr_token, joined_at, checked_in_at";
    private final JdbcTemplate jdbc;

    // Uses the transaction-bound database connection supplied by Spring.
    public ParticipationRepositoryImpl(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    // Finds one event/user pair, including a cancelled or banned row.
    @Override
    public Optional<EventParticipant> find(UUID eventId, UUID userId) {
        return jdbc.query("SELECT " + COLUMNS + " FROM event_participants WHERE event_id=? AND user_id=?",
                mapper(), eventId, userId).stream().findFirst();
    }

    // Stores a new ticket with a stable random token.
    @Override
    public void insert(EventParticipant p) {
        jdbc.update("INSERT INTO event_participants (event_id,user_id,status,qr_token,joined_at) VALUES (?,?,?,?,?)",
                p.eventId(), p.userId(), p.status(), p.qrToken(), Timestamp.from(p.joinedAt()));
    }

    // Updates only status; QR and original join time are retained.
    @Override
    public void status(UUID eventId, UUID userId, String status) {
        jdbc.update("UPDATE event_participants SET status=? WHERE event_id=? AND user_id=?", status, eventId, userId);
    }

    // Shows every participant except one who cancelled.
    @Override
    public List<EventParticipant> participants(UUID eventId) {
        return jdbc.query("SELECT " + COLUMNS + " FROM event_participants WHERE event_id=? "
                + "AND status<>'CANCELLED' ORDER BY joined_at, user_id", mapper(), eventId);
    }

    // Lists a user's non-cancelled participation in event start order.
    @Override
    public List<EventParticipant> joinedBy(UUID userId) {
        return jdbc.query("SELECT p." + COLUMNS.replace(", ", ", p.")
                + " FROM event_participants p JOIN events e ON e.id=p.event_id WHERE p.user_id=? "
                + "AND p.status<>'CANCELLED' ORDER BY e.starts_at, e.id", mapper(), userId);
    }

    // Applies a floor of zero, then appends the full rule value to the audit log.
    @Override
    public int changeReliability(UUID userId, UUID eventId, int points, String reason, Instant changedAt) {
        jdbc.update("UPDATE profiles SET reliability_score=GREATEST(0,reliability_score+?) WHERE id=?", points, userId);
        jdbc.update("INSERT INTO reliability_log (id,user_id,event_id,points_change,reason,created_at) "
                + "VALUES (?,?,?,?,?,?)", UUID.randomUUID(), userId, eventId, points, reason,
                Timestamp.from(changedAt));
        return jdbc.queryForObject("SELECT reliability_score FROM profiles WHERE id=?", Integer.class, userId);
    }

    // Maps a participant row to its domain entity.
    private static RowMapper<EventParticipant> mapper() {
        return (rs, n) -> new EventParticipant(rs.getObject("event_id", UUID.class),
                rs.getObject("user_id", UUID.class), rs.getString("status"),
                rs.getObject("qr_token", UUID.class), rs.getTimestamp("joined_at").toInstant(),
                instant(rs, "checked_in_at"));
    }

    // Reads a nullable check-in timestamp.
    private static Instant instant(ResultSet rs, String column) throws SQLException {
        Timestamp value = rs.getTimestamp(column);
        return value == null ? null : value.toInstant();
    }
}
