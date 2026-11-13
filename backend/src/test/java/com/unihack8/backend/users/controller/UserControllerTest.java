package com.unihack8.backend.users.controller;

import com.unihack8.backend.common.CurrentUser;
import com.unihack8.backend.config.SecurityConfig;
import com.unihack8.backend.users.domain.dto.ProfileResponse;
import com.unihack8.backend.users.domain.dto.ProfileSearchResult;
import com.unihack8.backend.users.service.UserNotFoundException;
import com.unihack8.backend.users.service.UserService;
import com.unihack8.backend.users.service.UsernameTakenException;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.BadJwtException;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(UserController.class)
@Import({SecurityConfig.class, CurrentUser.class, UserExceptionHandler.class})
class UserControllerTest {
    private static final UUID USER_ID = UUID.fromString("11111111-1111-1111-1111-111111111111");
    private static final UUID OTHER_ID = UUID.fromString("22222222-2222-2222-2222-222222222222");

    @Autowired
    private MockMvc mvc;

    @MockitoBean
    private UserService users;

    @MockitoBean
    private JwtDecoder jwtDecoder;

    // GET /users/me uses the verified token subject.
    @Test
    void readsOwnProfile() throws Exception {
        when(users.getOwnProfile(USER_ID)).thenReturn(profile(USER_ID));
        mvc.perform(get("/users/me").with(jwt().jwt(token -> token.subject(USER_ID.toString()))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(USER_ID.toString()))
                .andExpect(jsonPath("$.username").value("alex_21"));
    }

    // PATCH /users/me rejects a username already held by another user.
    @Test
    void reportsTakenUsername() throws Exception {
        when(users.updateUsername(USER_ID, "taken_name")).thenThrow(new UsernameTakenException());
        mvc.perform(patch("/users/me")
                        .with(jwt().jwt(token -> token.subject(USER_ID.toString())))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"taken_name\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("USERNAME_TAKEN"));
    }

    // PATCH /users/me accepts the documented username shape.
    @Test
    void updatesUsername() throws Exception {
        when(users.updateUsername(USER_ID, "new_name")).thenReturn(
                new ProfileResponse(USER_ID, "new_name", 100, Instant.parse("2026-11-13T10:00:00Z"), List.of()));
        mvc.perform(patch("/users/me")
                        .with(jwt().jwt(token -> token.subject(USER_ID.toString())))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"new_name\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.username").value("new_name"));
    }

    // PATCH /users/me validates usernames before calling the service.
    @Test
    void rejectsInvalidUsername() throws Exception {
        mvc.perform(patch("/users/me")
                        .with(jwt().jwt(token -> token.subject(USER_ID.toString())))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"bad name\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_INPUT"));
    }

    // GET /users/search returns compact, public results.
    @Test
    void searchesByUsername() throws Exception {
        when(users.search("al")).thenReturn(List.of(new ProfileSearchResult(USER_ID, "alex_21", 100)));
        mvc.perform(get("/users/search").param("q", "al")
                        .with(jwt().jwt(token -> token.subject(USER_ID.toString()))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].username").value("alex_21"));
    }

    // GET /users/{id} returns another user's public profile.
    @Test
    void readsPublicProfile() throws Exception {
        when(users.getPublicProfile(OTHER_ID)).thenReturn(profile(OTHER_ID));
        mvc.perform(get("/users/{id}", OTHER_ID)
                        .with(jwt().jwt(token -> token.subject(USER_ID.toString()))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(OTHER_ID.toString()));
    }

    // Missing user IDs are mapped to the documented 404 shape.
    @Test
    void reportsMissingUser() throws Exception {
        when(users.getPublicProfile(OTHER_ID)).thenThrow(new UserNotFoundException());
        mvc.perform(get("/users/{id}", OTHER_ID)
                        .with(jwt().jwt(token -> token.subject(USER_ID.toString()))))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("USER_NOT_FOUND"));
    }

    // Every user endpoint requires a bearer token, including public profiles.
    @Test
    void rejectsRequestsWithoutToken() throws Exception {
        mvc.perform(get("/users/me")).andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHORIZED"));
        mvc.perform(patch("/users/me").contentType(MediaType.APPLICATION_JSON)
                .content("{\"username\":\"new_name\"}")).andExpect(status().isUnauthorized());
        mvc.perform(get("/users/search").param("q", "al")).andExpect(status().isUnauthorized());
        mvc.perform(get("/users/{id}", OTHER_ID)).andExpect(status().isUnauthorized());
        mvc.perform(get("/events/{id}/my-ticket", OTHER_ID)).andExpect(status().isUnauthorized());
    }

    // An invalid bearer token must not reach the profile service.
    @Test
    void rejectsInvalidToken() throws Exception {
        when(jwtDecoder.decode("invalid")).thenThrow(new BadJwtException("invalid token"));
        mvc.perform(get("/users/me").header("Authorization", "Bearer invalid"))
                .andExpect(status().isUnauthorized());
    }

    // Builds consistent profile responses for controller scenarios.
    private ProfileResponse profile(UUID id) {
        return new ProfileResponse(id, "alex_21", 100, Instant.parse("2026-11-13T10:00:00Z"), List.of());
    }
}
