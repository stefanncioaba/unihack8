package com.unihack8.backend.reviews.repository.impl;

import com.unihack8.backend.reviews.domain.dto.RatingStats;
import com.unihack8.backend.reviews.domain.entity.EventReview;
import com.unihack8.backend.reviews.domain.entity.SettlementCandidate;
import com.unihack8.backend.reviews.repository.ReviewRepository;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

/** JdbcTemplate implementation over event_reviews and events.review_settled_at. */
@Repository
public class ReviewRepositoryImpl implements ReviewRepository {
    private static final String COLUMNS = "event_id, reviewer_id, rating, comment, created_at, updated_at";
    private final JdbcTemplate jdbc;
    private final NamedParameterJdbcTemplate named;

    // Uses the transaction-bound connection supplied by Spring.
    public ReviewRepositoryImpl(JdbcTemplate jdbc, NamedParameterJdbcTemplate named) {
        this.jdbc = jdbc;
        this.named = named;
    }

    // One event/reviewer pair.
    @Override
    public Optional<EventReview> find(UUID eventId, UUID reviewerId) {
        return jdbc.query("SELECT " + COLUMNS + " FROM event_reviews WHERE event_id=? AND reviewer_id=?",
                mapper(), eventId, reviewerId).stream().findFirst();
    }

    // Inserts a fresh review row.
    @Override
    public void insert(EventReview r) {
        jdbc.update("INSERT INTO event_reviews (" + COLUMNS + ") VALUES (?,?,?,?,?,?)", r.eventId(), r.reviewerId(),
                r.rating(), r.comment(), Timestamp.from(r.createdAt()), Timestamp.from(r.updatedAt()));
    }

    // Overwrites rating, comment and update time; the creation time is kept.
    @Override
    public void update(EventReview r) {
        jdbc.update("UPDATE event_reviews SET rating=?, comment=?, updated_at=? WHERE event_id=? AND reviewer_id=?",
                r.rating(), r.comment(), Timestamp.from(r.updatedAt()), r.eventId(), r.reviewerId());
    }

    // Newest activity first so a fresh or edited review shows on top.
    @Override
    public List<EventReview> forEvent(UUID eventId) {
        return jdbc.query("SELECT " + COLUMNS + " FROM event_reviews WHERE event_id=? "
                + "ORDER BY updated_at DESC, reviewer_id", mapper(), eventId);
    }

    // Average and count of one event's reviews.
    @Override
    public RatingStats stats(UUID eventId) {
        return stats(List.of(eventId)).getOrDefault(eventId, RatingStats.NONE);
    }

    // Grouped average and count; the cast keeps the average fractional on H2 and PostgreSQL.
    @Override
    public Map<UUID, RatingStats> stats(List<UUID> eventIds) {
        if (eventIds.isEmpty()) return Map.of();
        Map<UUID, RatingStats> result = new HashMap<>();
        named.query("SELECT event_id, AVG(CAST(rating AS DOUBLE PRECISION)) AS average, COUNT(*) AS total "
                        + "FROM event_reviews WHERE event_id IN (:eventIds) GROUP BY event_id",
                new MapSqlParameterSource("eventIds", eventIds), rs -> {
                    result.put(rs.getObject("event_id", UUID.class),
                            new RatingStats(rs.getDouble("average"), rs.getInt("total")));
                });
        return result;
    }

    // True once review_settled_at is set.
    @Override
    public boolean isSettled(UUID eventId) {
        return jdbc.query("SELECT review_settled_at FROM events WHERE id=?",
                (rs, n) -> rs.getTimestamp("review_settled_at") != null, eventId).stream().findFirst().orElse(false);
    }

    // Started user events still waiting for settlement; whether the window is over is decided in Java.
    @Override
    public List<SettlementCandidate> unsettledStartedBefore(Instant time) {
        return jdbc.query("SELECT id, organizer_id, starts_at, ends_at FROM events "
                        + "WHERE source='USER' AND review_settled_at IS NULL AND starts_at <= ? ORDER BY starts_at, id",
                (rs, n) -> new SettlementCandidate(rs.getObject("id", UUID.class),
                        rs.getObject("organizer_id", UUID.class), instant(rs, "starts_at"), instant(rs, "ends_at")),
                Timestamp.from(time));
    }

    // Conditional on NULL so two job runs can never settle the same event twice.
    @Override
    public int markSettled(UUID eventId, Instant settledAt) {
        return jdbc.update("UPDATE events SET review_settled_at=? WHERE id=? AND review_settled_at IS NULL",
                Timestamp.from(settledAt), eventId);
    }

    // Maps a review row to its entity.
    private static RowMapper<EventReview> mapper() {
        return (rs, n) -> new EventReview(rs.getObject("event_id", UUID.class), rs.getObject("reviewer_id", UUID.class),
                rs.getInt("rating"), rs.getString("comment"), instant(rs, "created_at"), instant(rs, "updated_at"));
    }

    // Nullable timestamp column as an Instant.
    private static Instant instant(ResultSet rs, String column) throws SQLException {
        Timestamp value = rs.getTimestamp(column);
        return value == null ? null : value.toInstant();
    }
}
