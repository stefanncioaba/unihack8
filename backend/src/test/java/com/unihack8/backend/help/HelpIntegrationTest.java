package com.unihack8.backend.help;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import com.unihack8.backend.help.support.HelpTestSchema;
import com.unihack8.backend.support.JwtTestTokens;
import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
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

/**
 * Neighbour Help Board (PLAN 25) through the real endpoints, real tokens and the H2 test database:
 * post, board, offer, ticket, first scan closes and gives +5 only to that helper, 24 h expiry,
 * withdraw / re-offer, cancel and every refusal.
 */
@SpringBootTest
@AutoConfigureMockMvc
class HelpIntegrationTest {

    private static final UUID ASKER = UUID.fromString("b2b2b2b2-0000-0000-0000-000000000001");
    private static final UUID HELPER = UUID.fromString("b2b2b2b2-0000-0000-0000-000000000002");
    private static final UUID SECOND = UUID.fromString("b2b2b2b2-0000-0000-0000-000000000003");

    @Autowired private MockMvc mvc;
    @Autowired private JdbcTemplate jdbc;

    private final Instant now = Instant.now();

    // Help tables, three users at 100 points, no old log rows for them.
    @BeforeEach
    void setUp() {
        HelpTestSchema.create(jdbc);
        jdbc.update("DELETE FROM reliability_log WHERE user_id IN (?,?,?)", ASKER, HELPER, SECOND);
        jdbc.update("DELETE FROM user_skills WHERE user_id IN (?,?,?)", ASKER, HELPER, SECOND);
        jdbc.update("DELETE FROM profiles WHERE id IN (?,?,?)", ASKER, HELPER, SECOND);
        for (UUID id : List.of(ASKER, HELPER, SECOND)) {
            jdbc.update("INSERT INTO profiles (id,username,reliability_score,created_at) VALUES (?,?,100,?)",
                    id, "help_" + id.toString().substring(35), Timestamp.from(now));
        }
    }

    // Authorization header for a signed-in user.
    private static String auth(UUID user) {
        return "Bearer " + JwtTestTokens.valid(user);
    }

    // POST /help-requests as ASKER with this JSON body.
    private ResultActions ask(String json) throws Exception {
        return mvc.perform(MockMvcRequestBuildersShortcut.json(post("/help-requests"), ASKER, json));
    }

    // Posts a valid request and returns its id.
    private UUID postRequest() throws Exception {
        String body = ask("{\"title\":\"Borrow a ladder\",\"description\":\"Changing a bulb.\",\"category\":\"BORROW\","
                + "\"address\":\"Strada Paris 12\",\"lat\":45.7489,\"lon\":21.2318}")
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        return UUID.fromString(JsonPath.read(body, "$.id"));
    }

    // Offers as `user`; returns the QR token.
    private String offer(UUID request, UUID user) throws Exception {
        String body = mvc.perform(post("/help-requests/" + request + "/offers").header("Authorization", auth(user)))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        return JsonPath.read(body, "$.qrToken");
    }

    // The requester (or `who`) scans this token.
    private ResultActions scan(UUID request, UUID who, String token) throws Exception {
        return mvc.perform(MockMvcRequestBuildersShortcut.json(post("/help-requests/" + request + "/check-in"), who,
                "{\"token\":\"" + token + "\"}"));
    }

    // Current score of a user.
    private int score(UUID user) {
        return jdbc.queryForObject("SELECT reliability_score FROM profiles WHERE id=?", Integer.class, user);
    }

    // Number of reliability log rows of a user.
    private int logRows(UUID user) {
        return jdbc.queryForObject("SELECT COUNT(*) FROM reliability_log WHERE user_id=?", Integer.class, user);
    }

    // Moves a request's creation and expiry into the past, as if posted 25 hours ago.
    private void age(UUID request) {
        jdbc.update("UPDATE help_requests SET created_at=?, expires_at=? WHERE id=?",
                Timestamp.from(now.minus(Duration.ofHours(25))), Timestamp.from(now.minus(Duration.ofHours(1))), request);
    }

    // Posting returns the detail; the request is on the board for others with requester and expiry.
    @Test
    void postAndBoard() throws Exception {
        UUID id = postRequest();
        mvc.perform(get("/help-requests").header("Authorization", auth(HELPER)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(id.toString()))
                .andExpect(jsonPath("$[0].status").value("OPEN"))
                .andExpect(jsonPath("$[0].requester.id").value(ASKER.toString()))
                .andExpect(jsonPath("$[0].requester.reliabilityScore").value(100))
                .andExpect(jsonPath("$[0].offerCount").value(0))
                .andExpect(jsonPath("$[0].myOffer").doesNotExist());
        String expires = jdbc.queryForObject("SELECT expires_at FROM help_requests WHERE id=?", Timestamp.class, id)
                .toInstant().toString();
        Instant created = jdbc.queryForObject("SELECT created_at FROM help_requests WHERE id=?", Timestamp.class, id)
                .toInstant();
        assertThat(Instant.parse(expires)).isEqualTo(created.plus(Duration.ofHours(24)));
    }

    // PLAN 28: each offer on the detail page lists that helper's profile skills; helpers without skills get [].
    @Test
    void offersShowHelperSkills() throws Exception {
        UUID id = postRequest();
        mvc.perform(MockMvcRequestBuildersShortcut.json(post("/users/me/skills"), HELPER,
                "{\"name\":\"Carpentry\",\"category\":\"CARPENTRY\"}")).andExpect(status().isCreated());
        mvc.perform(MockMvcRequestBuildersShortcut.json(post("/users/me/skills"), HELPER,
                "{\"name\":\"Ladders and heights\",\"category\":\"borrow\"}")).andExpect(status().isCreated());
        offer(id, HELPER);
        offer(id, SECOND);
        mvc.perform(get("/help-requests/" + id).header("Authorization", auth(ASKER)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.offers[0].user.id").value(HELPER.toString()))
                .andExpect(jsonPath("$.offers[0].skills.length()").value(2))
                .andExpect(jsonPath("$.offers[0].skills[0].name").value("Carpentry"))
                .andExpect(jsonPath("$.offers[0].skills[1].category").value("BORROW"))
                .andExpect(jsonPath("$.offers[1].skills.length()").value(0));
    }

    // PLAN 28: the new categories can be posted.
    @Test
    void newCategoriesAccepted() throws Exception {
        ask("{\"title\":\"Fix a dripping tap\",\"category\":\"PLUMBING\"}").andExpect(status().isCreated())
                .andExpect(jsonPath("$.category").value("PLUMBING"));
        ask("{\"title\":\"Keep my gran company\",\"category\":\"ELDERLY\"}").andExpect(status().isCreated());
    }

    // The board needs a token.
    @Test
    void boardNeedsToken() throws Exception {
        mvc.perform(get("/help-requests")).andExpect(status().isUnauthorized());
    }

    // Bad bodies answer 400 VALIDATION_FAILED.
    @Test
    void validation() throws Exception {
        ask("{\"title\":\"Hi\",\"category\":\"BORROW\"}").andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
        ask("{\"title\":\"Borrow a ladder\",\"category\":\"PARTY\"}").andExpect(status().isBadRequest());
        ask("{\"title\":\"Borrow a ladder\",\"category\":\"BORROW\",\"lat\":45.7}").andExpect(status().isBadRequest());
        ask("{\"title\":\"Borrow a ladder\",\"category\":\"BORROW\",\"lat\":145,\"lon\":21}")
                .andExpect(status().isBadRequest());
        ask("{\"title\":\"Borrow a ladder\",\"category\":\"BORROW\",\"description\":\"" + "x".repeat(501) + "\"}")
                .andExpect(status().isBadRequest());
    }

    // The full happy path: two helpers offer, the first scanned closes it, +5 for them only.
    @Test
    void firstScannedHelperClosesTheRequest() throws Exception {
        UUID id = postRequest();
        String helperToken = offer(id, HELPER);
        String secondToken = offer(id, SECOND);

        mvc.perform(get("/help-requests/" + id).header("Authorization", auth(ASKER)))
                .andExpect(jsonPath("$.offerCount").value(2))
                .andExpect(jsonPath("$.offers[0].user.id").value(HELPER.toString()))
                .andExpect(jsonPath("$.offers[1].user.reliabilityScore").value(100))
                .andExpect(jsonPath("$.isRequester").value(true))
                .andExpect(jsonPath("$.canOffer").value(false));
        mvc.perform(get("/help-requests/" + id + "/my-ticket").header("Authorization", auth(HELPER)))
                .andExpect(jsonPath("$.qrToken").value(helperToken))
                .andExpect(jsonPath("$.status").value("OFFERED"));

        scan(id, ASKER, helperToken).andExpect(status().isOk())
                .andExpect(jsonPath("$.user.id").value(HELPER.toString()))
                .andExpect(jsonPath("$.user.reliabilityScore").value(105))
                .andExpect(jsonPath("$.status").value("HELPED"))
                .andExpect(jsonPath("$.pointsChange").value(5));

        assertThat(score(HELPER)).isEqualTo(105);
        assertThat(score(SECOND)).isEqualTo(100);
        assertThat(score(ASKER)).isEqualTo(100);
        assertThat(logRows(SECOND)).isZero();
        assertThat(logRows(ASKER)).isZero();
        assertThat(jdbc.queryForObject("SELECT reason FROM reliability_log WHERE user_id=?", String.class, HELPER))
                .isEqualTo("HELPED");

        mvc.perform(get("/help-requests/" + id).header("Authorization", auth(SECOND)))
                .andExpect(jsonPath("$.status").value("HELPED"))
                .andExpect(jsonPath("$.helper.id").value(HELPER.toString()))
                .andExpect(jsonPath("$.closedAt").exists())
                .andExpect(jsonPath("$.myOffer").value("NOT_NEEDED"));
        mvc.perform(get("/help-requests/" + id + "/my-ticket").header("Authorization", auth(SECOND)))
                .andExpect(jsonPath("$.status").value("NOT_NEEDED"));

        // The closed request leaves the board; any later scan is refused and changes nothing.
        mvc.perform(get("/help-requests").header("Authorization", auth(SECOND)))
                .andExpect(jsonPath("$.length()").value(0));
        scan(id, ASKER, helperToken).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("HELP_CLOSED"));
        scan(id, ASKER, secondToken).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("HELP_CLOSED"));
        assertThat(score(HELPER)).isEqualTo(105);
        assertThat(score(SECOND)).isEqualTo(100);
    }

    // Only the requester scans; garbage, unknown and other-request tokens are refused.
    @Test
    void scanRefusals() throws Exception {
        UUID id = postRequest();
        String token = offer(id, HELPER);
        UUID other = postRequest();
        String otherToken = offer(other, SECOND);

        scan(id, HELPER, token).andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("NOT_REQUESTER"));
        scan(id, ASKER, "not-a-ticket").andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("TICKET_NOT_FOUND"));
        scan(id, ASKER, UUID.randomUUID().toString()).andExpect(jsonPath("$.code").value("TICKET_NOT_FOUND"));
        scan(id, ASKER, otherToken).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("WRONG_REQUEST"));
        scan(id, ASKER, " ").andExpect(status().isBadRequest());
        assertThat(score(HELPER)).isEqualTo(100);
    }

    // Offer refusals: own request, twice; withdraw is free and re-offering keeps the QR token.
    @Test
    void offerWithdrawAndReoffer() throws Exception {
        UUID id = postRequest();
        mvc.perform(post("/help-requests/" + id + "/offers").header("Authorization", auth(ASKER)))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("IS_REQUESTER"));
        String token = offer(id, HELPER);
        mvc.perform(post("/help-requests/" + id + "/offers").header("Authorization", auth(HELPER)))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("ALREADY_OFFERED"));

        mvc.perform(delete("/help-requests/" + id + "/offers/me").header("Authorization", auth(HELPER)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("WITHDRAWN"));
        assertThat(score(HELPER)).isEqualTo(100);
        mvc.perform(delete("/help-requests/" + id + "/offers/me").header("Authorization", auth(HELPER)))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("NOT_OFFERED"));
        mvc.perform(get("/help-requests/" + id + "/my-ticket").header("Authorization", auth(HELPER)))
                .andExpect(jsonPath("$.code").value("NOT_OFFERED"));
        scan(id, ASKER, token).andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("NOT_OFFERED"));
        mvc.perform(get("/help-requests/" + id).header("Authorization", auth(ASKER)))
                .andExpect(jsonPath("$.offers.length()").value(0));

        assertThat(offer(id, HELPER)).isEqualTo(token);
        mvc.perform(get("/help-requests/" + id).header("Authorization", auth(HELPER)))
                .andExpect(jsonPath("$.myOffer").value("OFFERED"))
                .andExpect(jsonPath("$.canOffer").value(false));
    }

    // After 24 hours the request is hidden and frozen, and nobody's score changes.
    @Test
    void expiresAfter24Hours() throws Exception {
        UUID id = postRequest();
        String token = offer(id, HELPER);
        age(id);
        mvc.perform(get("/help-requests").header("Authorization", auth(SECOND)))
                .andExpect(jsonPath("$.length()").value(0));
        mvc.perform(get("/help-requests/" + id).header("Authorization", auth(SECOND)))
                .andExpect(jsonPath("$.status").value("EXPIRED"))
                .andExpect(jsonPath("$.canOffer").value(false));
        mvc.perform(post("/help-requests/" + id + "/offers").header("Authorization", auth(SECOND)))
                .andExpect(jsonPath("$.code").value("HELP_CLOSED"));
        scan(id, ASKER, token).andExpect(jsonPath("$.code").value("HELP_CLOSED"));
        assertThat(score(HELPER)).isEqualTo(100);
        assertThat(score(ASKER)).isEqualTo(100);
        assertThat(logRows(HELPER)).isZero();
    }

    // The requester cancels for free; others cannot; a cancelled request takes no offers.
    @Test
    void cancel() throws Exception {
        UUID id = postRequest();
        offer(id, HELPER);
        mvc.perform(delete("/help-requests/" + id).header("Authorization", auth(HELPER)))
                .andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("NOT_REQUESTER"));
        mvc.perform(delete("/help-requests/" + id).header("Authorization", auth(ASKER)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.status").value("CANCELLED"));
        mvc.perform(delete("/help-requests/" + id).header("Authorization", auth(ASKER)))
                .andExpect(jsonPath("$.code").value("HELP_CLOSED"));
        mvc.perform(post("/help-requests/" + id + "/offers").header("Authorization", auth(SECOND)))
                .andExpect(jsonPath("$.code").value("HELP_CLOSED"));
        assertThat(score(ASKER)).isEqualTo(100);
        assertThat(score(HELPER)).isEqualTo(100);
    }

    // "Mine" lists what I asked for and what I offered on, and an unknown id is 404.
    @Test
    void mineAndNotFound() throws Exception {
        UUID id = postRequest();
        offer(id, HELPER);
        mvc.perform(get("/help-requests/mine").header("Authorization", auth(ASKER)))
                .andExpect(jsonPath("$.requested[0].id").value(id.toString()))
                .andExpect(jsonPath("$.requested[0].offerCount").value(1))
                .andExpect(jsonPath("$.offered.length()").value(0));
        mvc.perform(get("/help-requests/mine").header("Authorization", auth(HELPER)))
                .andExpect(jsonPath("$.requested.length()").value(0))
                .andExpect(jsonPath("$.offered[0].myOffer").value("OFFERED"));
        mvc.perform(get("/help-requests/" + UUID.randomUUID()).header("Authorization", auth(ASKER)))
                .andExpect(status().isNotFound());
    }

    // With near=lat,lon the nearest request comes first and requests without a location last.
    @Test
    void nearSortsByDistance() throws Exception {
        UUID far = postRequest();
        String noLocation = JsonPath.read(ask("{\"title\":\"Carry a sofa\",\"category\":\"CARRY\"}")
                .andReturn().getResponse().getContentAsString(), "$.id");
        String close = JsonPath.read(ask("{\"title\":\"Walk my dog\",\"category\":\"PETS\",\"lat\":45.7537,"
                + "\"lon\":21.2257}").andReturn().getResponse().getContentAsString(), "$.id");
        mvc.perform(get("/help-requests").param("near", "45.7537,21.2257").header("Authorization", auth(HELPER)))
                .andExpect(jsonPath("$[0].id").value(close))
                .andExpect(jsonPath("$[1].id").value(far.toString()))
                .andExpect(jsonPath("$[2].id").value(noLocation));
        mvc.perform(get("/help-requests").param("near", "nope").header("Authorization", auth(HELPER)))
                .andExpect(status().isBadRequest());
    }

    // bbox keeps only open, located requests inside the box (edges included); closed and unlocated ones are left out.
    @Test
    void bboxFiltersOneArea() throws Exception {
        UUID inside = postRequest(); // 45.7489, 21.2318
        ask("{\"title\":\"Carry a sofa\",\"category\":\"CARRY\"}");
        ask("{\"title\":\"Feed my cat\",\"category\":\"PETS\",\"lat\":45.70,\"lon\":21.30}");
        UUID helped = postRequest();
        scan(helped, ASKER, offer(helped, HELPER)).andExpect(status().isOk());
        mvc.perform(get("/help-requests").param("bbox", "21.2318,45.74,21.24,45.7489")
                        .header("Authorization", auth(SECOND)))
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].id").value(inside.toString()))
                .andExpect(jsonPath("$[0].lat").value(45.7489))
                .andExpect(jsonPath("$[0].requester.username").exists())
                .andExpect(jsonPath("$[0].offerCount").value(0))
                .andExpect(jsonPath("$[0].expiresAt").exists());
        mvc.perform(get("/help-requests").param("bbox", "21.2,45.7").header("Authorization", auth(SECOND)))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
    }

    /** Small helper so JSON posts with a token stay on one line. */
    private static final class MockMvcRequestBuildersShortcut {

        // Adds the token and a JSON body.
        static org.springframework.test.web.servlet.RequestBuilder json(
                org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder builder, UUID user,
                String json) {
            return builder.header("Authorization", auth(user)).contentType(MediaType.APPLICATION_JSON).content(json);
        }
    }
}
