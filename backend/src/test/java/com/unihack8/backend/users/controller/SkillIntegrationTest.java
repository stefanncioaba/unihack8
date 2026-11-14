package com.unihack8.backend.users.controller;

import com.jayway.jsonpath.JsonPath;
import com.unihack8.backend.reviews.support.ReviewTestSchema;
import com.unihack8.backend.support.JwtTestTokens;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.UUID;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Profile skills (PLAN 28) through the real endpoints, tokens and the H2 database: add, list on my and on a
 * public profile, edit, delete, and the refusals (token, validation, duplicate, limit, someone else's skill).
 */
@SpringBootTest
@AutoConfigureMockMvc
class SkillIntegrationTest {
    private static final UUID ME = UUID.fromString("c3c3c3c3-0000-0000-0000-000000000001");
    private static final UUID OTHER = UUID.fromString("c3c3c3c3-0000-0000-0000-000000000002");

    @Autowired
    private MockMvc mvc;

    @Autowired
    private JdbcTemplate jdbc;

    // Two fresh users without skills; the event tables the profile query reads (same DDL as the other integration tests, which share this H2 database).
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
        ReviewTestSchema.create(jdbc);
        jdbc.update("DELETE FROM user_skills WHERE user_id IN (?,?)", ME, OTHER);
        jdbc.update("DELETE FROM profiles WHERE id IN (?,?)", ME, OTHER);
        jdbc.update("INSERT INTO profiles (id,username,reliability_score,created_at) VALUES (?,?,100,?)", ME,
                "skill_me", Timestamp.from(Instant.now()));
        jdbc.update("INSERT INTO profiles (id,username,reliability_score,created_at) VALUES (?,?,100,?)", OTHER,
                "skill_other", Timestamp.from(Instant.now()));
    }

    // Authorization header for a signed-in user.
    private static String auth(UUID user) {
        return "Bearer " + JwtTestTokens.valid(user);
    }

    // POST /users/me/skills as `user`.
    private ResultActions add(UUID user, String name, String category) throws Exception {
        return mvc.perform(post("/users/me/skills").header("Authorization", auth(user))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"" + name + "\",\"category\":\"" + category + "\"}"));
    }

    // Adds a skill and returns its id.
    private String addId(UUID user, String name, String category) throws Exception {
        String body = add(user, name, category).andExpect(status().isCreated()).andReturn().getResponse()
                .getContentAsString();
        return JsonPath.read(body, "$.id");
    }

    // Add, then see it in my list, on GET /users/me and on my public profile.
    @Test
    void addAndRead() throws Exception {
        add(ME, " Carpentry ", "carpentry").andExpect(status().isCreated())
                .andExpect(jsonPath("$.name").value("Carpentry"))
                .andExpect(jsonPath("$.category").value("CARPENTRY"));
        addId(ME, "Tutoring maths", "TUTORING");

        mvc.perform(get("/users/me/skills").header("Authorization", auth(ME))).andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].name").value("Carpentry"))
                .andExpect(jsonPath("$[1].name").value("Tutoring maths"));
        mvc.perform(get("/users/me").header("Authorization", auth(ME))).andExpect(status().isOk())
                .andExpect(jsonPath("$.skills.length()").value(2));
        mvc.perform(get("/users/" + ME).header("Authorization", auth(OTHER))).andExpect(status().isOk())
                .andExpect(jsonPath("$.skills[0].category").value("CARPENTRY"));
        mvc.perform(get("/users/" + OTHER).header("Authorization", auth(ME))).andExpect(status().isOk())
                .andExpect(jsonPath("$.skills.length()").value(0));
    }

    // Edit renames and recategorises; delete removes it (204) and a second delete is 404.
    @Test
    void editAndDelete() throws Exception {
        String id = addId(ME, "Painting", "PAINTING");
        mvc.perform(patch("/users/me/skills/" + id).header("Authorization", auth(ME))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"Wall painting\",\"category\":\"REPAIRS\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(id))
                .andExpect(jsonPath("$.name").value("Wall painting"))
                .andExpect(jsonPath("$.category").value("REPAIRS"));

        mvc.perform(delete("/users/me/skills/" + id).header("Authorization", auth(ME))).andExpect(status().isNoContent());
        mvc.perform(get("/users/me/skills").header("Authorization", auth(ME))).andExpect(jsonPath("$.length()").value(0));
        mvc.perform(delete("/users/me/skills/" + id).header("Authorization", auth(ME))).andExpect(status().isNotFound());
    }

    // Another user cannot edit or delete my skill (404, the skill stays).
    @Test
    void othersCannotChangeMySkill() throws Exception {
        String id = addId(ME, "Cooking", "COOKING");
        mvc.perform(patch("/users/me/skills/" + id).header("Authorization", auth(OTHER))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"Hacked\",\"category\":\"OTHER\"}"))
                .andExpect(status().isNotFound());
        mvc.perform(delete("/users/me/skills/" + id).header("Authorization", auth(OTHER))).andExpect(status().isNotFound());
        mvc.perform(get("/users/me/skills").header("Authorization", auth(ME)))
                .andExpect(jsonPath("$[0].name").value("Cooking"));
    }

    // No token is 401; bad name / category is 400; duplicates and the 11th skill are 409.
    @Test
    void refusals() throws Exception {
        mvc.perform(get("/users/me/skills")).andExpect(status().isUnauthorized());
        add(ME, "x", "TECH").andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
        add(ME, "Welding", "WELDING").andExpect(status().isBadRequest());

        addId(ME, "Tech help", "TECH");
        add(ME, "TECH HELP", "TECH").andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("SKILL_EXISTS"));
        for (int i = 1; i < 10; i++) {
            addId(ME, "Skill " + i, "OTHER");
        }
        add(ME, "Eleventh", "OTHER").andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("SKILL_LIMIT"));
        // The other user is not affected by my limit.
        add(OTHER, "Tech help", "TECH").andExpect(status().isCreated());
    }
}
