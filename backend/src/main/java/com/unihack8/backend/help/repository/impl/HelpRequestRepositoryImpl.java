package com.unihack8.backend.help.repository.impl;

import com.unihack8.backend.common.geo.BoundingBox;
import com.unihack8.backend.help.domain.entity.HelpRequest;
import com.unihack8.backend.help.domain.entity.HelpRequestView;
import com.unihack8.backend.help.repository.HelpRequestRepository;
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

/**
 * JdbcTemplate implementation over help_requests, help_offers and profiles (same style as the events
 * feature). Views join the requester's profile, count current offers and read the caller's own offer.
 */
@Repository
public class HelpRequestRepositoryImpl implements HelpRequestRepository {

    private static final String COLUMNS = "r.id, r.requester_id, r.title, r.description, r.category, r.address, "
            + "r.lat, r.lon, r.status, r.created_at, r.expires_at, r.closed_at, r.helper_id";

    // Request + requester + offer count + caller's offer; the caller is the first `?`.
    private static final String VIEW = "SELECT " + COLUMNS + ", p.username, p.reliability_score, "
            + "(SELECT COUNT(*) FROM help_offers o WHERE o.request_id = r.id AND o.status IN ('OFFERED','HELPED')) "
            + "AS offer_count, mine.status AS my_offer FROM help_requests r "
            + "JOIN profiles p ON p.id = r.requester_id "
            + "LEFT JOIN help_offers mine ON mine.request_id = r.id AND mine.helper_id = ? ";

    private final JdbcTemplate jdbc;

    // Uses the transaction-bound connection supplied by Spring.
    public HelpRequestRepositoryImpl(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    // Saves every column of a new request.
    @Override
    public void insert(HelpRequest r) {
        jdbc.update("INSERT INTO help_requests (id,requester_id,title,description,category,address,lat,lon,status,"
                        + "created_at,expires_at,closed_at,helper_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
                r.id(), r.requesterId(), r.title(), r.description(), r.category(), r.address(), r.lat(), r.lon(),
                r.status(), Timestamp.from(r.createdAt()), Timestamp.from(r.expiresAt()), timestamp(r.closedAt()),
                r.helperId());
    }

    // One view by id.
    @Override
    public Optional<HelpRequestView> findView(UUID id, UUID caller) {
        return jdbc.query(VIEW + "WHERE r.id = ?", viewMapper(), caller, id).stream().findFirst();
    }

    // SELECT ... FOR UPDATE on the request row only.
    @Override
    public Optional<HelpRequest> lock(UUID id) {
        return jdbc.query("SELECT " + COLUMNS + " FROM help_requests r WHERE r.id = ? FOR UPDATE",
                (rs, n) -> request(rs), id).stream().findFirst();
    }

    // The board: open and not expired; a bbox keeps only located requests inside it (edges included).
    @Override
    public List<HelpRequestView> openRequests(Instant now, UUID caller, BoundingBox bbox, int limit) {
        if (bbox == null) {
            return jdbc.query(VIEW + "WHERE r.status = 'OPEN' AND r.expires_at > ? "
                    + "ORDER BY r.created_at DESC, r.id LIMIT ?", viewMapper(), caller, Timestamp.from(now), limit);
        }
        return jdbc.query(VIEW + "WHERE r.status = 'OPEN' AND r.expires_at > ? "
                        + "AND r.lat BETWEEN ? AND ? AND r.lon BETWEEN ? AND ? ORDER BY r.created_at DESC, r.id LIMIT ?",
                viewMapper(), caller, Timestamp.from(now), bbox.minLat(), bbox.maxLat(), bbox.minLon(), bbox.maxLon(),
                limit);
    }

    // The user's own requests (the user is also the caller; they never have an offer on them).
    @Override
    public List<HelpRequestView> requestedBy(UUID userId, int limit) {
        return jdbc.query(VIEW + "WHERE r.requester_id = ? ORDER BY r.created_at DESC, r.id LIMIT ?",
                viewMapper(), userId, userId, limit);
    }

    // Requests with a current or finished offer by the user.
    @Override
    public List<HelpRequestView> offeredBy(UUID userId, int limit) {
        return jdbc.query(VIEW + "WHERE mine.status IS NOT NULL AND mine.status <> 'WITHDRAWN' "
                + "ORDER BY r.created_at DESC, r.id LIMIT ?", viewMapper(), userId, limit);
    }

    // Conditional on OPEN.
    @Override
    public int cancel(UUID id, Instant closedAt) {
        return jdbc.update("UPDATE help_requests SET status = 'CANCELLED', closed_at = ? WHERE id = ? AND status = 'OPEN'",
                Timestamp.from(closedAt), id);
    }

    // Conditional on OPEN.
    @Override
    public int close(UUID id, UUID helperId, Instant closedAt) {
        return jdbc.update("UPDATE help_requests SET status = 'HELPED', closed_at = ?, helper_id = ? "
                + "WHERE id = ? AND status = 'OPEN'", Timestamp.from(closedAt), helperId, id);
    }

    // Maps a VIEW row.
    private static RowMapper<HelpRequestView> viewMapper() {
        return (rs, n) -> new HelpRequestView(request(rs), rs.getString("username"), rs.getInt("reliability_score"),
                rs.getInt("offer_count"), rs.getString("my_offer"));
    }

    // Maps the request columns of the current row.
    private static HelpRequest request(ResultSet rs) throws SQLException {
        return new HelpRequest(rs.getObject("id", UUID.class), rs.getObject("requester_id", UUID.class),
                rs.getString("title"), rs.getString("description"), rs.getString("category"),
                rs.getString("address"), number(rs, "lat"), number(rs, "lon"), rs.getString("status"),
                instant(rs, "created_at"), instant(rs, "expires_at"), instant(rs, "closed_at"),
                rs.getObject("helper_id", UUID.class));
    }

    // Nullable double column.
    private static Double number(ResultSet rs, String column) throws SQLException {
        double value = rs.getDouble(column);
        return rs.wasNull() ? null : value;
    }

    // Nullable timestamp column as an Instant.
    private static Instant instant(ResultSet rs, String column) throws SQLException {
        Timestamp value = rs.getTimestamp(column);
        return value == null ? null : value.toInstant();
    }

    // Nullable Instant as a JDBC timestamp.
    private static Timestamp timestamp(Instant value) {
        return value == null ? null : Timestamp.from(value);
    }
}
