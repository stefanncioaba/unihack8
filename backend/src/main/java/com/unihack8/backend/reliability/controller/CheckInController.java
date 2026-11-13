package com.unihack8.backend.reliability.controller;

import com.unihack8.backend.common.security.CurrentUser;
import com.unihack8.backend.reliability.domain.dto.CheckInRequest;
import com.unihack8.backend.reliability.domain.dto.CheckInResponse;
import com.unihack8.backend.reliability.domain.dto.TicketResponse;
import com.unihack8.backend.reliability.service.CheckInService;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/** QR ticket and check-in endpoints (PLAN 6.1, 6.2; docs/API.md). Both need a signed-in caller. */
@RestController
public class CheckInController {

    private final CheckInService checkIns;
    private final CurrentUser currentUser;

    // Needs the check-in service and the current-user helper.
    public CheckInController(CheckInService checkIns, CurrentUser currentUser) {
        this.checkIns = checkIns;
        this.currentUser = currentUser;
    }

    // GET /events/{id}/my-ticket — the caller's QR token for the event.
    @GetMapping("/events/{id}/my-ticket")
    public TicketResponse myTicket(@PathVariable UUID id) {
        return checkIns.myTicket(id, currentUser.id());
    }

    // POST /events/{id}/check-in — the organiser scanned a participant's QR code.
    @PostMapping("/events/{id}/check-in")
    public CheckInResponse checkIn(@PathVariable UUID id, @Valid @RequestBody CheckInRequest request) {
        return checkIns.checkIn(id, currentUser.id(), request.token());
    }
}
