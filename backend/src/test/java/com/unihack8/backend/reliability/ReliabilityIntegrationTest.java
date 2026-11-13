package com.unihack8.backend.reliability;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.unihack8.backend.events.repository.ParticipationRepository;
import com.unihack8.backend.reliability.repository.CheckInRepository;
import com.unihack8.backend.reliability.service.NoShowService;
import com.unihack8.backend.reliability.service.impl.NoShowServiceImpl;
import com.unihack8.backend.support.JwtTestTokens;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.PlatformTransactionManager;

/**
 * QR ticket, check-in, no-show job and reliability history (PLAN 6.1–6.5) against the H2 test
 * database, through the real endpoints and real tokens.
 */
@SpringBootTest
@AutoConfigureMockMvc
class ReliabilityIntegrationTest {

    private static final UUID HOST = UUID.fromString("a1a1a1a1-0000-0000-0000-000000000001");
    private static final UUID GUEST = UUID.fromString("a1a1a1a1-0000-0000-0000-000000000002");
    private static final UUID OTHER = UUID.fromString("a1a1a1a1-0000-0000-0000-000000000003");

    @Autowired private MockMvc mvc;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private CheckInRepository checkIns;
    @Autowired private ParticipationRepository participations;
    @Autowired private PlatformTransactionManager transactionManager;

    private final Instant now = Instant.now();

    // Same task-5 tables as EventDatabaseIntegrationTest (identical DDL, shared H2 database), three users at 100.
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
        jdbc.update("DELETE FROM profiles WHERE id IN (?,?,?)", HOST, GUEST, OTHER);
        for (UUID id : List.of(HOST, GUEST, OTHER)) {
            jdbc.update("INSERT INTO profiles (id,username,reliability_score,created_at) VALUES (?,?,100,?)",
                    id, "rel_" + id.toString().substring(34), Timestamp.from(now));
        }
    }

    // Inserts an event; endsAt may be null.
    private UUID event(String source, UUID organizer, Instant startsAt, Instant endsAt) {
        UUID id = UUID.randomUUID();
        jdbc.update("INSERT INTO events (id,source,external_id,title,starts_at,ends_at,organizer_id,created_at) "
                        + "VALUES (?,?,?,?,?,?,?,?)", id, source, "USER".equals(source) ? null : "livetickets:" + id,
                "Event " + id.toString().substring(0, 4), Timestamp.from(startsAt),
                endsAt == null ? null : Timestamp.from(endsAt), organizer, Timestamp.from(now));
        return id;
    }

    // A user event by HOST running right now (started an hour ago, ends in two hours).
    private UUID runningEvent() {
        return event("USER", HOST, now.minus(Duration.ofHours(1)), now.plus(Duration.ofHours(2)));
    }

    // Adds a participant with the given status; returns its QR token.
    private UUID participant(UUID eventId, UUID userId, String status) {
        UUID token = UUID.randomUUID();
        jdbc.update("INSERT INTO event_participants (event_id,user_id,status,qr_token,joined_at,checked_in_at) "
                        + "VALUES (?,?,?,?,?,?)", eventId, userId, status, token, Timestamp.from(now.minusSeconds(7200)),
                "ATTENDED".equals(status) ? Timestamp.from(now) : null);
        return token;
    }

    // Authorization header for a signed-in user.
    private static String auth(UUID user) {
        return "Bearer " + JwtTestTokens.valid(user);
    }

    // POSTs a check-in as `organizer` with this token text.
    private org.springframework.test.web.servlet.ResultActions scan(UUID eventId, UUID organizer, String token)
            throws Exception {
        return mvc.perform(post("/events/" + eventId + "/check-in").header("Authorization", auth(organizer))
                .contentType(MediaType.APPLICATION_JSON).content("{\"token\":\"" + token + "\"}"));
    }

    // Current score of a user.
    private int score(UUID user) {
        return jdbc.queryForObject("SELECT reliability_score FROM profiles WHERE id=?", Integer.class, user);
    }

    // Status of a participant row.
    private String statusOf(UUID eventId, UUID user) {
        return jdbc.queryForObject("SELECT status FROM event_participants WHERE event_id=? AND user_id=?",
                String.class, eventId, user);
    }

    // No-show service whose "now" is the given instant.
    private NoShowService noShowsAt(Instant at) {
        return new NoShowServiceImpl(checkIns, participations, transactionManager, Clock.fixed(at, ZoneOffset.UTC));
    }

    // --- 6.1 my ticket ---

    // A participant gets their own QR token and status.
    @Test
    void myTicketReturnsToken() throws Exception {
        UUID event = runningEvent();
        UUID token = participant(event, GUEST, "JOINED");

        mvc.perform(get("/events/" + event + "/my-ticket").header("Authorization", auth(GUEST)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.eventId").value(event.toString()))
                .andExpect(jsonPath("$.qrToken").value(token.toString()))
                .andExpect(jsonPath("$.status").value("JOINED"));
    }

    // Not joined, left, banned, unknown event, or no login.
    @Test
    void myTicketErrors() throws Exception {
        UUID event = runningEvent();
        participant(event, OTHER, "CANCELLED");
        participant(event, HOST, "BANNED");

        mvc.perform(get("/events/" + event + "/my-ticket").header("Authorization", auth(GUEST)))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("NOT_JOINED"));
        mvc.perform(get("/events/" + event + "/my-ticket").header("Authorization", auth(OTHER)))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("NOT_JOINED"));
        mvc.perform(get("/events/" + event + "/my-ticket").header("Authorization", auth(HOST)))
                .andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("BANNED"));
        mvc.perform(get("/events/" + UUID.randomUUID() + "/my-ticket").header("Authorization", auth(GUEST)))
                .andExpect(status().isNotFound());
        mvc.perform(get("/events/" + event + "/my-ticket")).andExpect(status().isUnauthorized());
    }

    // --- 6.2 check-in ---

    // The organiser's scan marks ATTENDED, adds +5 and logs it.
    @Test
    void checkInAddsPoints() throws Exception {
        UUID event = runningEvent();
        UUID token = participant(event, GUEST, "JOINED");

        scan(event, HOST, token.toString())
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.user.id").value(GUEST.toString()))
                .andExpect(jsonPath("$.user.reliabilityScore").value(105))
                .andExpect(jsonPath("$.status").value("ATTENDED"))
                .andExpect(jsonPath("$.pointsChange").value(5));

        assertThat(statusOf(event, GUEST)).isEqualTo("ATTENDED");
        assertThat(jdbc.queryForObject("SELECT checked_in_at FROM event_participants WHERE event_id=? AND user_id=?",
                Timestamp.class, event, GUEST)).isNotNull();
        Map<String, Object> logRow = jdbc.queryForMap("SELECT points_change, reason, event_id FROM reliability_log WHERE user_id=?", GUEST);
        assertThat(logRow).containsEntry("points_change", 5).containsEntry("reason", "ATTENDED").containsEntry("event_id", event);
    }

    // Scanning the same ticket twice gives points only once.
    @Test
    void secondScanIsRejected() throws Exception {
        UUID event = runningEvent();
        UUID token = participant(event, GUEST, "JOINED");

        scan(event, HOST, token.toString()).andExpect(status().isOk());
        scan(event, HOST, token.toString())
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("ALREADY_CHECKED_IN"));

        assertThat(score(GUEST)).isEqualTo(105);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM reliability_log WHERE user_id=?", Integer.class, GUEST)).isEqualTo(1);
    }

    // Only the organiser can scan; a ticket of another event, an unknown or garbage token are rejected.
    @Test
    void checkInValidatesOrganiserAndTicket() throws Exception {
        UUID event = runningEvent();
        UUID token = participant(event, GUEST, "JOINED");
        UUID otherEvent = event("USER", OTHER, now.minusSeconds(60), now.plusSeconds(3600));
        UUID otherToken = participant(otherEvent, GUEST, "JOINED");

        scan(event, OTHER, token.toString())
                .andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("NOT_ORGANIZER"));
        scan(event, HOST, otherToken.toString())
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("WRONG_EVENT"));
        scan(event, HOST, UUID.randomUUID().toString())
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("TICKET_NOT_FOUND"));
        scan(event, HOST, "https://example.com/not-a-ticket")
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("TICKET_NOT_FOUND"));
        mvc.perform(post("/events/" + event + "/check-in").header("Authorization", auth(HOST))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"token\":\" \"}"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
        mvc.perform(post("/events/" + event + "/check-in").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"token\":\"" + token + "\"}"))
                .andExpect(status().isUnauthorized());

        assertThat(score(GUEST)).isEqualTo(100);
        assertThat(statusOf(event, GUEST)).isEqualTo("JOINED");
    }

    // Imported events, finished events, banned and departed participants cannot be checked in.
    @Test
    void checkInRejectsWrongStates() throws Exception {
        UUID external = event("EXTERNAL", null, now.minusSeconds(60), now.plusSeconds(3600));
        scan(external, HOST, UUID.randomUUID().toString())
                .andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("EXTERNAL_EVENT"));

        UUID finished = event("USER", HOST, now.minus(Duration.ofHours(5)), now.minus(Duration.ofHours(1)));
        UUID late = participant(finished, GUEST, "JOINED");
        scan(finished, HOST, late.toString())
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("EVENT_ENDED"));

        UUID event = runningEvent();
        UUID banned = participant(event, GUEST, "BANNED");
        UUID left = participant(event, OTHER, "CANCELLED");
        scan(event, HOST, banned.toString())
                .andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("BANNED"));
        scan(event, HOST, left.toString())
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("NOT_JOINED"));
    }

    // An event without an end time can still be checked into until 3 hours after its start.
    @Test
    void checkInWithoutEndTimeUsesThreeHours() throws Exception {
        UUID event = event("USER", HOST, now.minus(Duration.ofHours(2)), null);
        UUID token = participant(event, GUEST, "JOINED");
        scan(event, HOST, token.toString()).andExpect(status().isOk());

        UUID over = event("USER", HOST, now.minus(Duration.ofHours(4)), null);
        UUID tooLate = participant(over, OTHER, "JOINED");
        scan(over, HOST, tooLate.toString()).andExpect(jsonPath("$.code").value("EVENT_ENDED"));
    }

    // --- 6.3 no-show job ---

    // After the end, still-JOINED participants become NO_SHOW with -10; attendees and others are untouched.
    @Test
    void noShowJobPenalisesOnlyAfterTheEnd() {
        Instant start = now.minus(Duration.ofHours(6));
        UUID event = event("USER", HOST, start, start.plus(Duration.ofHours(2)));
        participant(event, GUEST, "JOINED");
        participant(event, OTHER, "ATTENDED");
        UUID upcoming = event("USER", HOST, now.plus(Duration.ofDays(1)), null);
        participant(upcoming, HOST, "JOINED");
        UUID imported = event("EXTERNAL", null, start, start.plus(Duration.ofHours(1)));
        participant(imported, HOST, "JOINED");

        assertThat(noShowsAt(now).markNoShows()).isEqualTo(1);

        assertThat(statusOf(event, GUEST)).isEqualTo("NO_SHOW");
        assertThat(score(GUEST)).isEqualTo(90);
        assertThat(statusOf(event, OTHER)).isEqualTo("ATTENDED");
        assertThat(score(OTHER)).isEqualTo(100);
        assertThat(statusOf(upcoming, HOST)).isEqualTo("JOINED");
        assertThat(statusOf(imported, HOST)).isEqualTo("JOINED");
        assertThat(jdbc.queryForObject("SELECT reason FROM reliability_log WHERE user_id=?", String.class, GUEST))
                .isEqualTo("NO_SHOW");
    }

    // Running the job again changes nothing.
    @Test
    void noShowJobIsSafeToRepeat() {
        Instant start = now.minus(Duration.ofHours(6));
        UUID event = event("USER", HOST, start, start.plus(Duration.ofHours(1)));
        participant(event, GUEST, "JOINED");

        assertThat(noShowsAt(now).markNoShows()).isEqualTo(1);
        assertThat(noShowsAt(now).markNoShows()).isZero();
        assertThat(score(GUEST)).isEqualTo(90);
    }

    // No end time: not a no-show before start + 3 h, a no-show after.
    @Test
    void noShowWithoutEndTimeWaitsThreeHours() {
        Instant start = now.minus(Duration.ofHours(1));
        UUID event = event("USER", HOST, start, null);
        participant(event, GUEST, "JOINED");

        assertThat(noShowsAt(start.plus(Duration.ofMinutes(179))).markNoShows()).isZero();
        assertThat(noShowsAt(start.plus(Duration.ofMinutes(181))).markNoShows()).isEqualTo(1);
    }

    // The score never goes below 0, but the log keeps the full -10.
    @Test
    void scoreNeverBelowZero() {
        jdbc.update("UPDATE profiles SET reliability_score=5 WHERE id=?", GUEST);
        Instant start = now.minus(Duration.ofHours(6));
        UUID event = event("USER", HOST, start, start.plus(Duration.ofHours(1)));
        participant(event, GUEST, "JOINED");

        noShowsAt(now).markNoShows();

        assertThat(score(GUEST)).isZero();
        assertThat(jdbc.queryForObject("SELECT points_change FROM reliability_log WHERE user_id=?", Integer.class, GUEST))
                .isEqualTo(-10);
    }

    // --- 6.4 reliability history ---

    // Score and changes newest first with event titles; deleted events keep the entry without a title.
    @Test
    void reliabilityHistory() throws Exception {
        UUID event = runningEvent();
        UUID token = participant(event, GUEST, "JOINED");
        Instant start = now.minus(Duration.ofHours(6));
        UUID missed = event("USER", HOST, start, start.plus(Duration.ofHours(1)));
        participant(missed, GUEST, "JOINED");
        noShowsAt(now.minusSeconds(60)).markNoShows();
        scan(event, HOST, token.toString()).andExpect(status().isOk());
        jdbc.update("UPDATE reliability_log SET event_id=NULL WHERE event_id=?", missed);

        mvc.perform(get("/users/" + GUEST + "/reliability").header("Authorization", auth(OTHER)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.reliabilityScore").value(95))
                .andExpect(jsonPath("$.entries.length()").value(2))
                .andExpect(jsonPath("$.entries[0].pointsChange").value(5))
                .andExpect(jsonPath("$.entries[0].reason").value("ATTENDED"))
                .andExpect(jsonPath("$.entries[0].eventId").value(event.toString()))
                .andExpect(jsonPath("$.entries[0].eventTitle").isNotEmpty())
                .andExpect(jsonPath("$.entries[1].pointsChange").value(-10))
                .andExpect(jsonPath("$.entries[1].reason").value("NO_SHOW"))
                .andExpect(jsonPath("$.entries[1].eventId").isEmpty())
                .andExpect(jsonPath("$.entries[1].eventTitle").isEmpty());
    }

    // Unknown user is 404; no login is 401.
    @Test
    void reliabilityHistoryErrors() throws Exception {
        mvc.perform(get("/users/" + UUID.randomUUID() + "/reliability").header("Authorization", auth(GUEST)))
                .andExpect(status().isNotFound());
        mvc.perform(get("/users/" + GUEST + "/reliability")).andExpect(status().isUnauthorized());
    }
}
