package com.unihack8.backend.events.controller;

import com.unihack8.backend.common.dto.PageResponse;
import com.unihack8.backend.common.exception.ApiException;
import com.unihack8.backend.common.exception.ErrorCode;
import com.unihack8.backend.events.domain.dto.*;
import com.unihack8.backend.events.service.EventService;
import com.unihack8.backend.support.JwtTestTokens;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.mockito.ArgumentCaptor;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/** HTTP, JSON shape and token checks for the task-5 endpoints. */
@SpringBootTest
@AutoConfigureMockMvc
class EventControllerTest {
    private static final UUID EVENT = UUID.fromString("11111111-1111-1111-1111-111111111111");
    private static final UUID USER = UUID.fromString("22222222-2222-2222-2222-222222222222");
    @Autowired private MockMvc mvc;
    @MockitoBean private EventService service;

    // Public list requires no token and uses the shared page envelope.
    @Test
    void publicList() throws Exception {
        when(service.search(any(), any(), any(), any(), any(), any(), any(), any()))
                .thenReturn(new PageResponse<>(List.of(summary()), 0, 20, 1, 1));
        mvc.perform(get("/events"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].title").value("Meetup"))
                .andExpect(jsonPath("$.totalItems").value(1));
    }

    // Public detail omits caller status when no token is supplied.
    @Test
    void publicDetail() throws Exception {
        when(service.detail(EVENT, Optional.empty())).thenReturn(detail(null));
        mvc.perform(get("/events/{id}", EVENT))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.participantCount").value(1))
                .andExpect(jsonPath("$.myStatus").isEmpty());
    }

    // A verified token is passed to detail for caller-specific state.
    @Test
    void signedInDetail() throws Exception {
        when(service.detail(EVENT, Optional.of(USER))).thenReturn(detail("JOINED"));
        mvc.perform(get("/events/{id}", EVENT).header("Authorization", bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.myStatus").value("JOINED"));
    }

    // Create returns 201 with the new event detail.
    @Test
    void createsEvent() throws Exception {
        when(service.create(eq(USER), any(CreateEventRequest.class))).thenReturn(detail(null));
        mvc.perform(post("/events").header("Authorization", bearer()).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"title\":\"Meetup\",\"category\":\"MEETUP\",\"venueName\":\"Hall\","
                                + "\"lat\":45.7,\"lon\":21.2,\"startsAt\":\"2026-11-14T17:00:00Z\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(EVENT.toString()));
    }

    // PATCH keeps explicit null so the service can clear an optional capacity.
    @Test
    void updatesEventWithExplicitNull() throws Exception {
        when(service.update(eq(EVENT), eq(USER), any(UpdateEventRequest.class))).thenReturn(detail(null));
        mvc.perform(patch("/events/{id}", EVENT).header("Authorization", bearer())
                        .contentType(MediaType.APPLICATION_JSON).content("{\"capacity\":null}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.title").value("Meetup"));
        ArgumentCaptor<UpdateEventRequest> patch = ArgumentCaptor.forClass(UpdateEventRequest.class);
        verify(service).update(eq(EVENT), eq(USER), patch.capture());
        assertTrue(patch.getValue().has("capacity"));
        assertNull(patch.getValue().value("capacity"));
    }

    // DELETE returns the contract's empty 204 response.
    @Test
    void deletesEvent() throws Exception {
        mvc.perform(delete("/events/{id}", EVENT).header("Authorization", bearer()))
                .andExpect(status().isNoContent());
        verify(service).delete(EVENT, USER);
    }

    // Leaving returns the cancellation status, points and resulting score.
    @Test
    void leavesEvent() throws Exception {
        when(service.leave(EVENT, USER)).thenReturn(new LeaveResponse("CANCELLED", -2, 98));
        mvc.perform(delete("/events/{id}/join", EVENT).header("Authorization", bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CANCELLED"))
                .andExpect(jsonPath("$.pointsChange").value(-2))
                .andExpect(jsonPath("$.reliabilityScore").value(98));
    }

    // Participant listing exposes identity, reliability and status only to signed-in users.
    @Test
    void listsParticipants() throws Exception {
        when(service.participants(EVENT)).thenReturn(List.of(new ParticipantResponse(
                new UserSummary(USER, "guest", 91), "JOINED", Instant.parse("2026-11-13T18:40:00Z"))));
        mvc.perform(get("/events/{id}/participants", EVENT).header("Authorization", bearer()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].user.username").value("guest"))
                .andExpect(jsonPath("$[0].user.reliabilityScore").value(91));
    }

    // Join returns a stable ticket, and errors retain the shared shape.
    @Test
    void joinsAndReportsFullEvent() throws Exception {
        when(service.join(EVENT, USER)).thenReturn(new JoinResponse(EVENT, "JOINED", UUID.randomUUID()))
                .thenThrow(new ApiException(ErrorCode.EVENT_FULL));
        mvc.perform(post("/events/{id}/join", EVENT).header("Authorization", bearer()))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.status").value("JOINED"));
        mvc.perform(post("/events/{id}/join", EVENT).header("Authorization", bearer()))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("EVENT_FULL"));
    }

    // Signed-out callers cannot create, join, list participants or read their event lists.
    @Test
    void privateActionsRequireToken() throws Exception {
        mvc.perform(post("/events").contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isUnauthorized());
        mvc.perform(post("/events/{id}/join", EVENT)).andExpect(status().isUnauthorized());
        mvc.perform(get("/events/{id}/participants", EVENT)).andExpect(status().isUnauthorized());
        mvc.perform(get("/users/me/events")).andExpect(status().isUnauthorized());
    }

    // Organizer-only endpoints map the service's authorization error to 403.
    @Test
    void banReportsNotOrganizer() throws Exception {
        when(service.ban(EVENT, USER, USER)).thenThrow(new ApiException(ErrorCode.NOT_ORGANIZER));
        mvc.perform(post("/events/{id}/participants/{userId}/ban", EVENT, USER)
                        .header("Authorization", bearer()))
                .andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("NOT_ORGANIZER"));
    }

    // GET /users/me/events uses the current token's subject.
    @Test
    void listsMyEvents() throws Exception {
        when(service.mine(USER)).thenReturn(new MyEventsResponse(List.of(), List.of(summary())));
        mvc.perform(get("/users/me/events").header("Authorization", bearer()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.organizing[0].title").value("Meetup"));
    }

    // Produces the signed Supabase-style test bearer token.
    private String bearer() {
        return "Bearer " + JwtTestTokens.valid(USER);
    }

    // Representative list item for JSON contract assertions.
    private EventSummary summary() {
        return new EventSummary(EVENT, "USER", "Meetup", "MEETUP", "Hall", 45.7, 21.2,
                Instant.parse("2026-11-14T17:00:00Z"), null, null, null, null, 2, 1, 4.5, 2);
    }

    // Representative detail with one participant and an organizer.
    private EventDetail detail(String status) {
        return new EventDetail(EVENT, "USER", "Meetup", null, "MEETUP", "Hall", null, 45.7, 21.2,
                Instant.parse("2026-11-14T17:00:00Z"), null, null, null, null, null, 2, 1, 1,
                new UserSummary(USER, "host", 100), status, 4.5, 2);
    }
}
