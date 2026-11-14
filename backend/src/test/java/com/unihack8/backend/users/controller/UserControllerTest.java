package com.unihack8.backend.users.controller;

import com.unihack8.backend.common.exception.ApiException;
import com.unihack8.backend.common.exception.ErrorCode;
import com.unihack8.backend.support.JwtTestTokens;
import com.unihack8.backend.users.domain.dto.AttendedEventResponse;
import com.unihack8.backend.users.domain.dto.ProfileResponse;
import com.unihack8.backend.users.domain.dto.ProfileSearchResult;
import com.unihack8.backend.users.domain.dto.UsernameAvailabilityResponse;
import com.unihack8.backend.users.service.UserService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** The users endpoints through the real security chain and error handler, with the service mocked. */
@SpringBootTest
@AutoConfigureMockMvc
class UserControllerTest {
    private static final UUID USER_ID = UUID.fromString("11111111-1111-1111-1111-111111111111");
    private static final UUID OTHER_ID = UUID.fromString("22222222-2222-2222-2222-222222222222");

    @Autowired
    private MockMvc mvc;

    @MockitoBean
    private UserService users;

    // GET /users/me uses the verified token subject and returns the profile with its events.
    @Test
    void readsOwnProfile() throws Exception {
        when(users.getProfile(USER_ID)).thenReturn(profile(USER_ID));

        mvc.perform(get("/users/me").header("Authorization", bearer(USER_ID)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(USER_ID.toString()))
                .andExpect(jsonPath("$.username").value("alex_21"))
                .andExpect(jsonPath("$.reliabilityScore").value(100))
                .andExpect(jsonPath("$.attendedEvents[0].title").value("Meetup"))
                .andExpect(jsonPath("$.attendedEvents[0].spotsLeft").value(4))
                .andExpect(jsonPath("$.attendedEvents[0].endsAt").isEmpty());
    }

    // PATCH /users/me returns the updated profile.
    @Test
    void updatesUsername() throws Exception {
        when(users.updateUsername(USER_ID, "new_name")).thenReturn(
                new ProfileResponse(USER_ID, "new_name", 100, Instant.parse("2026-11-13T10:00:00Z"), List.of(), List.of()));

        mvc.perform(patch("/users/me").header("Authorization", bearer(USER_ID))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"new_name\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.username").value("new_name"));
    }

    // A username owned by someone else answers 409 USERNAME_TAKEN in the standard error shape.
    @Test
    void reportsTakenUsername() throws Exception {
        when(users.updateUsername(USER_ID, "taken_name")).thenThrow(new ApiException(ErrorCode.USERNAME_TAKEN));

        mvc.perform(patch("/users/me").header("Authorization", bearer(USER_ID))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"taken_name\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.status").value(409))
                .andExpect(jsonPath("$.code").value("USERNAME_TAKEN"))
                .andExpect(jsonPath("$.path").value("/users/me"));
    }

    // A missing request body is a 400 VALIDATION_FAILED.
    @Test
    void rejectsMissingBody() throws Exception {
        mvc.perform(patch("/users/me").header("Authorization", bearer(USER_ID))
                        .contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
    }

    // GET /users/search returns compact, public results.
    @Test
    void searchesByUsername() throws Exception {
        when(users.search("al")).thenReturn(List.of(new ProfileSearchResult(USER_ID, "alex_21", 100)));

        mvc.perform(get("/users/search").param("q", "al").header("Authorization", bearer(USER_ID)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].username").value("alex_21"))
                .andExpect(jsonPath("$[0].reliabilityScore").value(100));
    }

    // Search without q is a 400 that names the field.
    @Test
    void searchNeedsQuery() throws Exception {
        mvc.perform(get("/users/search").header("Authorization", bearer(USER_ID)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"))
                .andExpect(jsonPath("$.fields.q").exists());
    }

    // GET /users/{id} returns another user's public profile.
    @Test
    void readsPublicProfile() throws Exception {
        when(users.getProfile(OTHER_ID)).thenReturn(profile(OTHER_ID));

        mvc.perform(get("/users/{id}", OTHER_ID).header("Authorization", bearer(USER_ID)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(OTHER_ID.toString()));
    }

    // Unknown user ids answer 404 NOT_FOUND.
    @Test
    void reportsMissingUser() throws Exception {
        when(users.getProfile(OTHER_ID)).thenThrow(ApiException.notFound("User"));

        mvc.perform(get("/users/{id}", OTHER_ID).header("Authorization", bearer(USER_ID)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_FOUND"));
    }

    // An id that is not a UUID is a 400, not a server error.
    @Test
    void rejectsMalformedId() throws Exception {
        mvc.perform(get("/users/{id}", "not-a-uuid").header("Authorization", bearer(USER_ID)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
    }

    // The username check is public: no token needed (the sign-up screen calls it).
    @Test
    void usernameAvailabilityIsPublic() throws Exception {
        when(users.checkUsername("stefan")).thenReturn(new UsernameAvailabilityResponse("stefan", false));

        mvc.perform(get("/users/username-available").param("username", "stefan"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.username").value("stefan"))
                .andExpect(jsonPath("$.available").value(false));
    }

    // A badly formed username answers 400 INVALID_USERNAME.
    @Test
    void usernameAvailabilityRejectsBadFormat() throws Exception {
        when(users.checkUsername("no")).thenThrow(new ApiException(ErrorCode.INVALID_USERNAME));

        mvc.perform(get("/users/username-available").param("username", "no"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_USERNAME"));
    }

    // Every other user endpoint requires a bearer token.
    @Test
    void rejectsRequestsWithoutToken() throws Exception {
        mvc.perform(get("/users/me")).andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHORIZED"));
        mvc.perform(patch("/users/me").contentType(MediaType.APPLICATION_JSON)
                .content("{\"username\":\"new_name\"}")).andExpect(status().isUnauthorized());
        mvc.perform(get("/users/search").param("q", "al")).andExpect(status().isUnauthorized());
        mvc.perform(get("/users/{id}", OTHER_ID)).andExpect(status().isUnauthorized());
    }

    // An invalid bearer token never reaches the service.
    @Test
    void rejectsInvalidToken() throws Exception {
        mvc.perform(get("/users/me").header("Authorization", "Bearer invalid"))
                .andExpect(status().isUnauthorized());
    }

    // Authorization header with a real signed test token for the given user.
    private String bearer(UUID userId) {
        return "Bearer " + JwtTestTokens.valid(userId);
    }

    // Builds a profile with one attended event.
    private ProfileResponse profile(UUID id) {
        AttendedEventResponse event = new AttendedEventResponse(UUID.fromString("33333333-3333-3333-3333-333333333333"),
                "USER", "Meetup", "MEETUP", "Cafe", 45.75, 21.23, Instant.parse("2026-11-12T18:00:00Z"),
                null, null, null, null, 12, 4, 4.5, 2);
        return new ProfileResponse(id, "alex_21", 100, Instant.parse("2026-11-13T10:00:00Z"), List.of(event),
                List.of(event));
    }
}
