package com.unihack8.backend.events.controller;

import com.unihack8.backend.common.security.CurrentUser;
import com.unihack8.backend.events.domain.dto.MyEventsResponse;
import com.unihack8.backend.events.service.EventService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** The current user's event lists (PLAN 5.8). */
@RestController
@RequestMapping("/users/me/events")
public class MyEventsController {
    private final EventService events;
    private final CurrentUser currentUser;

    // Connects the verified token subject to the event service.
    public MyEventsController(EventService events, CurrentUser currentUser) {
        this.events = events;
        this.currentUser = currentUser;
    }

    // Returns non-cancelled joins and events the caller organizes.
    @GetMapping
    public MyEventsResponse mine() {
        return events.mine(currentUser.id());
    }
}
