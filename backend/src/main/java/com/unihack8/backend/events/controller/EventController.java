package com.unihack8.backend.events.controller;

import com.unihack8.backend.common.dto.PageResponse;
import com.unihack8.backend.common.security.CurrentUser;
import com.unihack8.backend.events.domain.dto.*;
import com.unihack8.backend.events.service.EventService;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** Event and participation endpoints from PLAN task 5. */
@RestController
@RequestMapping("/events")
public class EventController {
    private final EventService service;
    private final CurrentUser currentUser;

    // Delegates HTTP input and token identity to the event service.
    public EventController(EventService service, CurrentUser currentUser) {
        this.service = service;
        this.currentUser = currentUser;
    }

    // Public event list with date, text, category, viewport and source filters.
    @GetMapping
    public PageResponse<EventSummary> search(@RequestParam(required = false) String q,
            @RequestParam(required = false) List<String> category,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant to,
            @RequestParam(required = false) String bbox, @RequestParam(required = false) String source,
            @RequestParam(required = false) Integer page, @RequestParam(required = false) Integer size) {
        return service.search(q, category, from, to, bbox, source, page, size);
    }

    // Public detail includes caller status when a token is present.
    @GetMapping("/{id}")
    public EventDetail detail(@PathVariable UUID id) {
        return service.detail(id, currentUser.optionalId());
    }

    // Creates a user event owned by the signed-in caller.
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public EventDetail create(@RequestBody CreateEventRequest request) {
        return service.create(currentUser.id(), request);
    }

    // Updates an organizer-owned user event.
    @PatchMapping("/{id}")
    public EventDetail update(@PathVariable UUID id, @RequestBody Map<String, Object> request) {
        return service.update(id, currentUser.id(), new UpdateEventRequest(request));
    }

    // Removes an organizer-owned user event.
    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable UUID id) {
        service.delete(id, currentUser.id());
    }

    // Takes a spot and returns the caller's stable ticket token.
    @PostMapping("/{id}/join")
    @ResponseStatus(HttpStatus.CREATED)
    public JoinResponse join(@PathVariable UUID id) {
        return service.join(id, currentUser.id());
    }

    // Cancels the caller's join and reports any late penalty.
    @DeleteMapping("/{id}/join")
    public LeaveResponse leave(@PathVariable UUID id) {
        return service.leave(id, currentUser.id());
    }

    // Shows participant identities and scores to signed-in users.
    @GetMapping("/{id}/participants")
    public List<ParticipantResponse> participants(@PathVariable UUID id) {
        currentUser.id();
        return service.participants(id);
    }

    // Lets the organizer ban a joined participant.
    @PostMapping("/{id}/participants/{userId}/ban")
    public BanResponse ban(@PathVariable UUID id, @PathVariable UUID userId) {
        return service.ban(id, currentUser.id(), userId);
    }
}
