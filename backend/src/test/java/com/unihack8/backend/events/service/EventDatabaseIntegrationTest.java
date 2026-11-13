package com.unihack8.backend.events.service;

import com.unihack8.backend.common.exception.ApiException;
import com.unihack8.backend.common.exception.ErrorCode;
import com.unihack8.backend.events.domain.dto.CreateEventRequest;
import com.unihack8.backend.events.domain.dto.UpdateEventRequest;
import java.time.Instant;
import java.sql.Timestamp;
import java.util.HashMap;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;

import static org.junit.jupiter.api.Assertions.*;

/** Exercises real SQL transactions against H2, including the last-spot race. */
@SpringBootTest
class EventDatabaseIntegrationTest {
    private static final UUID HOST = UUID.fromString("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    private static final UUID FIRST = UUID.fromString("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
    private static final UUID SECOND = UUID.fromString("cccccccc-cccc-cccc-cccc-cccccccccccc");
    @Autowired private JdbcTemplate jdbc;
    @Autowired private EventService service;

    // Builds the task-5 tables around the profiles table managed by Hibernate in tests.
    @BeforeEach
    void setUp() {
        jdbc.execute("CREATE TABLE IF NOT EXISTS events (id UUID PRIMARY KEY, source VARCHAR(20) NOT NULL, "
                + "external_id VARCHAR(255), title VARCHAR(255) NOT NULL, description VARCHAR(1000), "
                + "category VARCHAR(30), venue_name VARCHAR(255), address VARCHAR(255), lat DOUBLE PRECISION, "
                + "lon DOUBLE PRECISION, starts_at TIMESTAMP WITH TIME ZONE NOT NULL, "
                + "ends_at TIMESTAMP WITH TIME ZONE, capacity INTEGER, organizer_id UUID, image_url VARCHAR(255), "
                + "price_min DECIMAL(10,2), price_max DECIMAL(10,2), external_url VARCHAR(255), "
                + "created_at TIMESTAMP WITH TIME ZONE NOT NULL)");
        jdbc.execute("CREATE TABLE IF NOT EXISTS event_participants (event_id UUID NOT NULL, user_id UUID NOT NULL, "
                + "status VARCHAR(20) NOT NULL, qr_token UUID NOT NULL UNIQUE, joined_at TIMESTAMP WITH TIME ZONE NOT NULL, "
                + "checked_in_at TIMESTAMP WITH TIME ZONE, PRIMARY KEY(event_id,user_id), "
                + "FOREIGN KEY(event_id) REFERENCES events(id) ON DELETE CASCADE)");
        jdbc.execute("CREATE TABLE IF NOT EXISTS reliability_log (id UUID PRIMARY KEY, user_id UUID NOT NULL, "
                + "event_id UUID, points_change INTEGER NOT NULL, reason VARCHAR(30) NOT NULL, "
                + "created_at TIMESTAMP WITH TIME ZONE NOT NULL)");
        jdbc.update("DELETE FROM reliability_log");
        jdbc.update("DELETE FROM event_participants");
        jdbc.update("DELETE FROM events");
        jdbc.update("DELETE FROM profiles WHERE id IN (?,?,?)", HOST, FIRST, SECOND);
        for (UUID id : List.of(HOST, FIRST, SECOND)) {
            jdbc.update("INSERT INTO profiles (id,username,reliability_score,created_at) VALUES (?,?,100,?)",
                    id, "user_" + id.toString().substring(0, 8), Instant.parse("2026-11-13T10:00:00Z"));
        }
    }

    // The event row lock permits exactly one of two simultaneous last-spot joins.
    @Test
    void concurrentJoinNeverOverbooks() throws Exception {
        UUID id = create(1);
        CyclicBarrier start = new CyclicBarrier(2);
        try (var pool = Executors.newFixedThreadPool(2)) {
            Callable<String> first = () -> attemptJoin(id, FIRST, start);
            Callable<String> second = () -> attemptJoin(id, SECOND, start);
            Future<String> a = pool.submit(first);
            Future<String> b = pool.submit(second);
            assertEquals(List.of("EVENT_FULL", "JOINED"),
                    List.of(a.get(), b.get()).stream().sorted().toList());
            assertEquals(1, jdbc.queryForObject("SELECT COUNT(*) FROM event_participants WHERE event_id=? "
                    + "AND status='JOINED'", Integer.class, id));
        }
    }

    // Real SQL covers filtering, capacity change, cancellation and organizer-only delete.
    @Test
    void eventLifecycleAndFilters() {
        UUID id = create(2);
        assertEquals(1, service.search("meet", List.of("MEETUP"), null, null,
                "21.1,45.6,21.3,45.8", "USER", 0, 20).totalItems());
        assertEquals(0, service.search("missing", List.of(), null, null,
                null, null, 0, 20).totalItems());
        var ticket = service.join(id, FIRST);
        assertEquals(1, service.search("meet", List.of("MEETUP"), null, null,
                null, null, 0, 20).items().getFirst().spotsLeft());
        assertEquals(1, service.detail(id, java.util.Optional.of(FIRST)).participantCount());
        assertEquals("JOINED", service.detail(id, java.util.Optional.of(FIRST)).myStatus());
        assertNotEquals(ticket.qrToken(), service.join(id, SECOND).qrToken());
        assertEquals(2, service.participants(id).size());
        assertEquals(1, service.mine(FIRST).joined().size());
        service.ban(id, HOST, SECOND);
        assertEquals(1, service.detail(id, java.util.Optional.empty()).spotsLeft());
        assertEquals(ErrorCode.BANNED, assertThrows(ApiException.class, () -> service.join(id, SECOND)).code());
        assertEquals("CANCELLED", service.leave(id, FIRST).status());
        assertEquals(1, service.participants(id).size());
        assertEquals("BANNED", service.participants(id).getFirst().status());
        assertEquals(ErrorCode.NOT_ORGANIZER,
                assertThrows(ApiException.class, () -> service.delete(id, FIRST)).code());
        service.delete(id, HOST);
        assertEquals(0, jdbc.queryForObject("SELECT COUNT(*) FROM events WHERE id=?", Integer.class, id));
        assertEquals(0, jdbc.queryForObject("SELECT COUNT(*) FROM event_participants WHERE event_id=?",
                Integer.class, id));
    }

    // Explicit null removes a capacity limit; an early cancellation costs no points.
    @Test
    void patchClearsCapacity() {
        UUID id = create(1);
        var fields = new HashMap<String, Object>();
        fields.put("capacity", null);
        assertNull(service.update(id, HOST, new UpdateEventRequest(fields)).capacity());
        service.join(id, FIRST);
        service.join(id, SECOND);
        assertEquals(2, service.detail(id, java.util.Optional.empty()).participantCount());
    }

    // Every documented list filter and stable paging order works against SQL.
    @Test
    void filtersAndPagesEvents() {
        UUID later = create(1);
        UUID earlier = create(1);
        jdbc.update("UPDATE events SET starts_at=?, ends_at=? WHERE id=?",
                Timestamp.from(Instant.parse("2030-11-14T16:00:00Z")),
                Timestamp.from(Instant.parse("2030-11-14T18:00:00Z")), earlier);
        var page = service.search(null, List.of(), null, null, null, null, 0, 1);
        assertEquals(2, page.totalItems());
        assertEquals(earlier, page.items().getFirst().id());
        assertEquals(later, service.search(null, List.of(), null, null, null, null, 1, 1)
                .items().getFirst().id());
        assertEquals(0, service.search("%", List.of(), null, null, null, null, 0, 20).totalItems());
        assertEquals(0, service.search(null, List.of("PARTY"), null, null, null, null, 0, 20).totalItems());
        assertEquals(0, service.search(null, List.of(), Instant.parse("2031-01-01T00:00:00Z"), null,
                null, null, 0, 20).totalItems());
        assertEquals(0, service.search(null, List.of(), Instant.parse("2028-01-01T00:00:00Z"),
                Instant.parse("2029-01-01T00:00:00Z"), null, null, 0, 20).totalItems());
        assertEquals(0, service.search(null, List.of(), null, null,
                "21.4,45.6,21.5,45.8", null, 0, 20).totalItems());
        assertEquals(0, service.search(null, List.of(), null, null,
                null, "EXTERNAL", 0, 20).totalItems());
        assertEquals(ErrorCode.VALIDATION_FAILED,
                assertThrows(ApiException.class, () -> service.search(null, List.of(), null, null,
                        "21.1,45.6,21.3,45.8", null, 0, 501)).code());
    }

    // The score floor is zero while the audit log keeps the full -2 rule value.
    @Test
    void lateCancellationNeverMakesScoreNegative() {
        UUID id = create(1);
        Instant start = Instant.now().plusSeconds(3600);
        jdbc.update("UPDATE events SET starts_at=?,ends_at=? WHERE id=?", Timestamp.from(start),
                Timestamp.from(start.plusSeconds(3600)), id);
        service.join(id, FIRST);
        jdbc.update("UPDATE profiles SET reliability_score=1 WHERE id=?", FIRST);
        var result = service.leave(id, FIRST);
        assertEquals(-2, result.pointsChange());
        assertEquals(0, result.reliabilityScore());
        assertEquals(-2, jdbc.queryForObject("SELECT points_change FROM reliability_log WHERE user_id=?",
                Integer.class, FIRST));
    }

    // Synchronizes two service transactions and returns the result code.
    private String attemptJoin(UUID id, UUID user, CyclicBarrier start) throws Exception {
        start.await();
        try {
            return service.join(id, user).status();
        } catch (ApiException e) {
            return e.code().name();
        }
    }

    // Inserts a real event through the service with a future start time.
    private UUID create(int capacity) {
        return service.create(HOST, new CreateEventRequest("Meetup", "Games", "MEETUP", "Hall", "Center",
                45.7, 21.2, Instant.parse("2030-11-14T17:00:00Z"),
                Instant.parse("2030-11-14T19:00:00Z"), capacity)).id();
    }
}
