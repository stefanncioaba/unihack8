package com.unihack8.backend.reviews;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.unihack8.backend.events.repository.ParticipationRepository;
import com.unihack8.backend.reviews.repository.ReviewRepository;
import com.unihack8.backend.reviews.service.ReviewSettlementService;
import com.unihack8.backend.reviews.service.impl.ReviewSettlementServiceImpl;
import com.unihack8.backend.reviews.support.ReviewTestSchema;
import com.unihack8.backend.support.JwtTestTokens;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.transaction.PlatformTransactionManager;

/**
 * Event reviews end to end against H2: check-in unlocks reviewing, the rating shows on the event,
 * the reviews list and the organiser's profile, and settlement moves the organiser's score once.
 */
@SpringBootTest
@AutoConfigureMockMvc
class ReviewIntegrationTest {
    private static final UUID HOST = UUID.fromString("b2b2b2b2-0000-0000-0000-000000000001");
    private static final UUID GUEST = UUID.fromString("b2b2b2b2-0000-0000-0000-000000000002");
    private static final UUID OTHER = UUID.fromString("b2b2b2b2-0000-0000-0000-000000000003");

    @Autowired private MockMvc mvc;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private ReviewRepository reviews;
    @Autowired private ParticipationRepository participations;
    @Autowired private PlatformTransactionManager transactionManager;

    private final Instant now = Instant.now();

    // Builds the event tables plus event_reviews and three fresh profiles.
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
        ReviewTestSchema.create(jdbc);
        jdbc.update("DELETE FROM reliability_log");
        jdbc.update("DELETE FROM event_participants");
        jdbc.update("DELETE FROM events");
        jdbc.update("DELETE FROM profiles WHERE id IN (?,?,?)", HOST, GUEST, OTHER);
        for (UUID id : List.of(HOST, GUEST, OTHER)) {
            jdbc.update("INSERT INTO profiles (id,username,reliability_score,created_at) VALUES (?,?,100,?)",
                    id, "rev_" + id.toString().substring(34), Timestamp.from(now));
        }
    }

    // Scanning a guest's ticket lets them rate; the rating shows on the event, the list and the summary.
    @Test
    void checkedInGuestReviewsAndRatingShowsEverywhere() throws Exception {
        UUID event = event(now.minus(Duration.ofHours(1)), now.plus(Duration.ofHours(2)));
        UUID token = participant(event, GUEST, "JOINED");

        review(event, GUEST, 5, "Great").andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("NOT_ATTENDED"));
        mvc.perform(post("/events/" + event + "/check-in").header("Authorization", auth(HOST))
                .contentType(MediaType.APPLICATION_JSON).content("{\"token\":\"" + token + "\"}"))
                .andExpect(status().isOk());

        mvc.perform(get("/events/" + event + "/reviews").header("Authorization", auth(GUEST)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.canReview").value(true))
                .andExpect(jsonPath("$.reviewCount").value(0));
        review(event, GUEST, 4, "  Nice crowd, started late  ").andExpect(status().isOk())
                .andExpect(jsonPath("$.reviewer.username").value("rev_02"))
                .andExpect(jsonPath("$.rating").value(4))
                .andExpect(jsonPath("$.comment").value("Nice crowd, started late"));
        review(event, GUEST, 5, null).andExpect(status().isOk());

        mvc.perform(get("/events/" + event + "/reviews"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.reviewCount").value(1))
                .andExpect(jsonPath("$.averageRating").value(5.0))
                .andExpect(jsonPath("$.reviews[0].reviewer.id").value(GUEST.toString()))
                .andExpect(jsonPath("$.reviews[0].comment").isEmpty())
                .andExpect(jsonPath("$.canReview").value(false))
                .andExpect(jsonPath("$.settled").value(false));
        mvc.perform(get("/events/" + event))
                .andExpect(jsonPath("$.averageRating").value(5.0))
                .andExpect(jsonPath("$.reviewCount").value(1));
        mvc.perform(get("/users/me/events").header("Authorization", auth(HOST)))
                .andExpect(jsonPath("$.organizing[0].reviewCount").value(1));
    }

    // The organiser and people who were not checked in cannot review; bad ratings are rejected.
    @Test
    void onlyAttendeesMayReview() throws Exception {
        UUID event = event(now.minus(Duration.ofHours(1)), now.plus(Duration.ofHours(2)));
        participant(event, GUEST, "ATTENDED");
        participant(event, OTHER, "JOINED");
        review(event, HOST, 5, null).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("IS_ORGANIZER"));
        review(event, OTHER, 5, null).andExpect(status().isForbidden());
        review(event, GUEST, 0, null).andExpect(status().isBadRequest());
        review(event, GUEST, 6, null).andExpect(status().isBadRequest());
        review(event, GUEST, 3, "x".repeat(301)).andExpect(status().isBadRequest());
        mvc.perform(put("/events/" + event + "/reviews/me").contentType(MediaType.APPLICATION_JSON)
                .content("{\"rating\":5}")).andExpect(status().isUnauthorized());
    }

    // Reviews close 24 h after the end; settlement then applies round((avg - 3) * 2.5) exactly once.
    @Test
    void settlementMovesOrganiserScoreOnceAfterWindow() throws Exception {
        UUID event = event(now.minus(Duration.ofHours(5)), now.minus(Duration.ofHours(2)));
        participant(event, GUEST, "ATTENDED");
        participant(event, OTHER, "ATTENDED");
        review(event, GUEST, 5, "Loved it").andExpect(status().isOk());
        review(event, OTHER, 4, null).andExpect(status().isOk());

        Instant beforeClose = now.plus(Duration.ofHours(21));
        assertThat(settlementAt(beforeClose).settleDueEvents()).isZero();
        assertThat(score(HOST)).isEqualTo(100);

        Instant afterClose = now.plus(Duration.ofHours(23));
        assertThat(settlementAt(afterClose).settleDueEvents()).isEqualTo(1);
        assertThat(settlementAt(afterClose).settleDueEvents()).isZero();
        // Average 4.5 -> (1.5 * 2.5 = 3.75) -> +4.
        assertThat(score(HOST)).isEqualTo(104);
        assertThat(jdbc.queryForObject("SELECT reason FROM reliability_log WHERE user_id=?", String.class, HOST))
                .isEqualTo("EVENT_RATING");
        mvc.perform(get("/events/" + event + "/reviews")).andExpect(jsonPath("$.settled").value(true));
    }

    // A low average costs the organiser points; an event without reviews changes nothing.
    @Test
    void lowRatingLosesPointsAndNoReviewsChangesNothing() throws Exception {
        UUID rated = event(now.minus(Duration.ofHours(5)), now.minus(Duration.ofHours(4)));
        UUID unrated = event(now.minus(Duration.ofHours(5)), now.minus(Duration.ofHours(4)));
        participant(rated, GUEST, "ATTENDED");
        review(rated, GUEST, 2, "Cancelled half the program").andExpect(status().isOk());

        assertThat(settlementAt(now.plus(Duration.ofHours(21))).settleDueEvents()).isEqualTo(1);
        assertThat(score(HOST)).isEqualTo(97);
        assertThat(reviews.isSettled(unrated)).isTrue();
        review(rated, GUEST, 5, null).andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("REVIEWS_CLOSED"));
    }

    // Past organised events appear on the organiser's public profile with their rating.
    @Test
    void profileListsPastOrganisedEventsWithRating() throws Exception {
        UUID past = event(now.minus(Duration.ofHours(6)), now.minus(Duration.ofHours(1)));
        event(now.plus(Duration.ofHours(6)), null);
        participant(past, GUEST, "ATTENDED");
        review(past, GUEST, 3, null).andExpect(status().isOk());
        mvc.perform(get("/users/" + HOST).header("Authorization", auth(OTHER)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.organizedEvents.length()").value(1))
                .andExpect(jsonPath("$.organizedEvents[0].id").value(past.toString()))
                .andExpect(jsonPath("$.organizedEvents[0].averageRating").value(3.0))
                .andExpect(jsonPath("$.organizedEvents[0].reviewCount").value(1));
    }

    // PUTs a review as `user`; a null comment is sent as JSON null.
    private ResultActions review(UUID eventId, UUID user, int rating, String comment) throws Exception {
        String body = "{\"rating\":" + rating + ",\"comment\":" + (comment == null ? "null" : "\"" + comment + "\"") + "}";
        return mvc.perform(put("/events/" + eventId + "/reviews/me").header("Authorization", auth(user))
                .contentType(MediaType.APPLICATION_JSON).content(body));
    }

    // Inserts a user event organised by HOST.
    private UUID event(Instant startsAt, Instant endsAt) {
        UUID id = UUID.randomUUID();
        jdbc.update("INSERT INTO events (id,source,title,category,venue_name,lat,lon,starts_at,ends_at,organizer_id,created_at) "
                        + "VALUES (?,'USER',?,'MEETUP','Hall',45.75,21.22,?,?,?,?)", id, "Review " + id.toString().substring(0, 4),
                Timestamp.from(startsAt), endsAt == null ? null : Timestamp.from(endsAt), HOST, Timestamp.from(now));
        return id;
    }

    // Adds a participant with the given status; returns its QR token.
    private UUID participant(UUID eventId, UUID userId, String status) {
        UUID token = UUID.randomUUID();
        jdbc.update("INSERT INTO event_participants (event_id,user_id,status,qr_token,joined_at,checked_in_at) "
                        + "VALUES (?,?,?,?,?,?)", eventId, userId, status, token, Timestamp.from(now.minusSeconds(7200)),
                "ATTENDED".equals(status) ? Timestamp.from(now) : null);
        return token;
    }

    // Settlement service whose "now" is the given instant.
    private ReviewSettlementService settlementAt(Instant at) {
        return new ReviewSettlementServiceImpl(reviews, participations, transactionManager, Clock.fixed(at, ZoneOffset.UTC));
    }

    // Current score of a user.
    private int score(UUID user) {
        return jdbc.queryForObject("SELECT reliability_score FROM profiles WHERE id=?", Integer.class, user);
    }

    // Authorization header for a signed-in user.
    private static String auth(UUID user) {
        return "Bearer " + JwtTestTokens.valid(user);
    }
}
