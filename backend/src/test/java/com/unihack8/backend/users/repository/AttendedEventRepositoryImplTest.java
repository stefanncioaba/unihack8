package com.unihack8.backend.users.repository;

import com.unihack8.backend.users.domain.dto.AttendedEventResponse;
import com.unihack8.backend.users.repository.impl.AttendedEventRepositoryImpl;
import com.unihack8.backend.reviews.support.ReviewTestSchema;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.jdbc.core.JdbcTemplate;

import javax.sql.DataSource;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

/**
 * The attended-events query against a small copy of the events tables (the real ones are created
 * by the Supabase migrations; here H2 gets only the columns the query reads).
 */
@DataJpaTest(properties = "spring.jpa.hibernate.ddl-auto=create-drop")
class AttendedEventRepositoryImplTest {
    private static final UUID ME = UUID.fromString("11111111-1111-1111-1111-111111111111");
    private static final UUID OTHER = UUID.fromString("22222222-2222-2222-2222-222222222222");

    @Autowired
    private DataSource dataSource;

    private JdbcTemplate jdbc;
    private AttendedEventRepositoryImpl repository;

    // Creates the two tables the query joins and starts every test with empty ones.
    @BeforeEach
    void setUp() {
        jdbc = new JdbcTemplate(dataSource);
        jdbc.execute("""
                CREATE TABLE IF NOT EXISTS events (
                    id UUID PRIMARY KEY, source VARCHAR(10) NOT NULL, title VARCHAR(200) NOT NULL,
                    category VARCHAR(20), venue_name VARCHAR(200), lat DOUBLE PRECISION, lon DOUBLE PRECISION,
                    starts_at TIMESTAMP WITH TIME ZONE NOT NULL, ends_at TIMESTAMP WITH TIME ZONE,
                    capacity INTEGER, image_url VARCHAR(500), price_min NUMERIC(10, 2), price_max NUMERIC(10, 2))
                """);
        jdbc.execute("""
                CREATE TABLE IF NOT EXISTS event_participants (
                    event_id UUID NOT NULL, user_id UUID NOT NULL, status VARCHAR(10) NOT NULL,
                    PRIMARY KEY (event_id, user_id))
                """);
        ReviewTestSchema.create(jdbc);
        jdbc.update("DELETE FROM event_participants");
        jdbc.update("DELETE FROM events");
        repository = new AttendedEventRepositoryImpl(jdbc);
    }

    // Only ATTENDED rows of the asked user count, newest event first.
    @Test
    void returnsOnlyAttendedEventsNewestFirst() {
        UUID older = event("Older", "2026-11-10T18:00:00Z", null, null);
        UUID newer = event("Newer", "2026-11-12T18:00:00Z", null, null);
        UUID joinedOnly = event("Joined only", "2026-11-11T18:00:00Z", null, null);
        UUID othersEvent = event("Someone else's", "2026-11-09T18:00:00Z", null, null);
        participant(older, ME, "ATTENDED");
        participant(newer, ME, "ATTENDED");
        participant(joinedOnly, ME, "JOINED");
        participant(othersEvent, OTHER, "ATTENDED");

        List<AttendedEventResponse> events = repository.findAttendedByUserId(ME);

        assertEquals(List.of("Newer", "Older"), events.stream().map(AttendedEventResponse::title).toList());
    }

    // A missing category shows as OTHER and spotsLeft counts JOINED and ATTENDED participants.
    @Test
    void fillsCategoryAndSpotsLeft() {
        UUID limited = event("Limited", "2026-11-12T18:00:00Z", 5, null);
        UUID unlimited = event("Unlimited", "2026-11-11T18:00:00Z", null, "MEETUP");
        participant(limited, ME, "ATTENDED");
        participant(limited, OTHER, "JOINED");
        participant(limited, UUID.randomUUID(), "CANCELLED");
        participant(unlimited, ME, "ATTENDED");

        List<AttendedEventResponse> events = repository.findAttendedByUserId(ME);

        AttendedEventResponse first = events.get(0);
        assertEquals("OTHER", first.category());
        assertEquals(5, first.capacity());
        assertEquals(3, first.spotsLeft());
        assertNull(first.endsAt());
        AttendedEventResponse second = events.get(1);
        assertEquals("MEETUP", second.category());
        assertNull(second.spotsLeft());
    }

    // The profile shows at most 20 events.
    @Test
    void returnsAtMostTwentyEvents() {
        for (int i = 0; i < 25; i++) {
            UUID id = event("Event " + i, Instant.parse("2026-11-01T18:00:00Z").plusSeconds(3600L * i).toString(),
                    null, null);
            participant(id, ME, "ATTENDED");
        }

        assertEquals(20, repository.findAttendedByUserId(ME).size());
    }

    // Inserts an event row and returns its id.
    private UUID event(String title, String startsAt, Integer capacity, String category) {
        UUID id = UUID.randomUUID();
        jdbc.update("INSERT INTO events (id, source, title, category, starts_at, capacity) VALUES (?, 'USER', ?, ?, ?, ?)",
                id, title, category, Timestamp.from(Instant.parse(startsAt)), capacity);
        return id;
    }

    // Inserts a participation row.
    private void participant(UUID eventId, UUID userId, String status) {
        jdbc.update("INSERT INTO event_participants (event_id, user_id, status) VALUES (?, ?, ?)",
                eventId, userId, status);
    }
}
