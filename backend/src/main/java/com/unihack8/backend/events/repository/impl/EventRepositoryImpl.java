package com.unihack8.backend.events.repository.impl;

import com.unihack8.backend.events.domain.dto.EventSearchCriteria;
import com.unihack8.backend.events.domain.entity.Event;
import com.unihack8.backend.events.repository.EventRepository;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

/** SQL implementation of event search and writes. */
@Repository
public class EventRepositoryImpl implements EventRepository {
    private static final String COLUMNS = "id, source, external_id, title, description, category, venue_name, address, lat, lon, "
            + "starts_at, ends_at, capacity, organizer_id, image_url, price_min, price_max, external_url, created_at";
    private final JdbcTemplate jdbc;
    private final NamedParameterJdbcTemplate named;

    // Shares Spring's transaction-bound connection across reads and writes.
    public EventRepositoryImpl(JdbcTemplate jdbc, NamedParameterJdbcTemplate named) {
        this.jdbc = jdbc;
        this.named = named;
    }

    // Applies each provided filter and returns a stable page ordered by start time and id.
    @Override
    public Page<Event> search(EventSearchCriteria c, Pageable page) {
        StringBuilder where = new StringBuilder(" WHERE 1=1");
        MapSqlParameterSource p = new MapSqlParameterSource();
        if (c.query() != null) {
            where.append(" AND LOWER(title) LIKE :q ESCAPE '\\'");
            p.addValue("q", "%" + escapeLike(c.query().toLowerCase(Locale.ROOT)) + "%");
        }
        if (!c.categories().isEmpty()) {
            where.append(" AND category IN (:categories)");
            p.addValue("categories", c.categories());
        }
        where.append(" AND starts_at >= :from");
        p.addValue("from", Timestamp.from(c.from()));
        if (c.to() != null) {
            where.append(" AND starts_at <= :to");
            p.addValue("to", Timestamp.from(c.to()));
        }
        if (c.bbox() != null) {
            where.append(" AND lat BETWEEN :minLat AND :maxLat AND lon BETWEEN :minLon AND :maxLon");
            p.addValue("minLat", c.bbox().minLat()).addValue("maxLat", c.bbox().maxLat())
                    .addValue("minLon", c.bbox().minLon()).addValue("maxLon", c.bbox().maxLon());
        }
        if (c.source() != null) {
            where.append(" AND source = :source");
            p.addValue("source", c.source());
        }
        long total = named.queryForObject("SELECT COUNT(*) FROM events" + where, p, Long.class);
        p.addValue("limit", page.getPageSize()).addValue("offset", page.getOffset());
        List<Event> rows = named.query("SELECT " + COLUMNS + " FROM events" + where
                + " ORDER BY starts_at, id LIMIT :limit OFFSET :offset", p, mapper());
        return new PageImpl<>(rows, page, total);
    }

    // Finds an event without changing concurrency state.
    @Override
    public Optional<Event> find(UUID id) {
        return jdbc.query("SELECT " + COLUMNS + " FROM events WHERE id = ?", mapper(), id).stream().findFirst();
    }

    // Locks the event row until the service transaction commits.
    @Override
    public Optional<Event> lock(UUID id) {
        return jdbc.query("SELECT " + COLUMNS + " FROM events WHERE id = ? FOR UPDATE", mapper(), id)
                .stream().findFirst();
    }

    // Saves a new user event with caller-owned organizer id.
    @Override
    public void insert(Event e) {
        jdbc.update("INSERT INTO events (id, source, title, description, category, venue_name, address, lat, lon, "
                + "starts_at, ends_at, capacity, organizer_id, created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
                e.id(), e.source(), e.title(), e.description(), e.category(), e.venueName(), e.address(),
                e.lat(), e.lon(), Timestamp.from(e.startsAt()), timestamp(e.endsAt()), e.capacity(),
                e.organizerId(), Timestamp.from(e.createdAt()));
    }

    // Updates fields the organizer may edit; source and import metadata stay intact.
    @Override
    public void update(Event e) {
        jdbc.update("UPDATE events SET title=?, description=?, category=?, venue_name=?, address=?, lat=?, lon=?, "
                + "starts_at=?, ends_at=?, capacity=? WHERE id=?",
                e.title(), e.description(), e.category(), e.venueName(), e.address(), e.lat(), e.lon(),
                Timestamp.from(e.startsAt()), timestamp(e.endsAt()), e.capacity(), e.id());
    }

    // Removes an organizer-owned event.
    @Override
    public void delete(UUID id) {
        jdbc.update("DELETE FROM events WHERE id=?", id);
    }

    // Lists the organizer's events by start time.
    @Override
    public List<Event> organizedBy(UUID userId) {
        return jdbc.query("SELECT " + COLUMNS + " FROM events WHERE organizer_id=? ORDER BY starts_at, id",
                mapper(), userId);
    }

    // Counts spots used by joined or attended people.
    @Override
    public int activeCount(UUID eventId) {
        return jdbc.queryForObject("SELECT COUNT(*) FROM event_participants WHERE event_id=? "
                + "AND status IN ('JOINED','ATTENDED')", Integer.class, eventId);
    }

    // Counts occupied spots for the current page in one grouped query.
    @Override
    public Map<UUID, Integer> activeCounts(List<UUID> eventIds) {
        if (eventIds.isEmpty()) return Map.of();
        Map<UUID, Integer> result = new HashMap<>();
        named.query("SELECT event_id, COUNT(*) AS occupied FROM event_participants "
                        + "WHERE event_id IN (:eventIds) AND status IN ('JOINED','ATTENDED') GROUP BY event_id",
                new MapSqlParameterSource("eventIds", eventIds), rs -> {
                    result.put(rs.getObject("event_id", UUID.class), rs.getInt("occupied"));
                });
        return result;
    }

    // Maps a database row to the domain entity.
    private static RowMapper<Event> mapper() {
        return (rs, n) -> new Event(rs.getObject("id", UUID.class), rs.getString("source"),
                rs.getString("external_id"), rs.getString("title"), rs.getString("description"),
                rs.getString("category"), rs.getString("venue_name"), rs.getString("address"),
                rs.getObject("lat", Double.class), rs.getObject("lon", Double.class),
                rs.getTimestamp("starts_at").toInstant(), instant(rs, "ends_at"),
                rs.getObject("capacity", Integer.class), rs.getObject("organizer_id", UUID.class),
                rs.getString("image_url"), rs.getBigDecimal("price_min"), rs.getBigDecimal("price_max"),
                rs.getString("external_url"), rs.getTimestamp("created_at").toInstant());
    }

    // Reads a nullable timestamp.
    private static Instant instant(ResultSet rs, String column) throws SQLException {
        Timestamp value = rs.getTimestamp(column);
        return value == null ? null : value.toInstant();
    }

    // Converts a nullable instant for JDBC writes.
    private static Timestamp timestamp(Instant value) {
        return value == null ? null : Timestamp.from(value);
    }

    // Treats LIKE wildcards in user text as literal characters.
    private static String escapeLike(String value) {
        return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
    }
}
