package com.unihack8.backend.help.controller;

import com.unihack8.backend.common.geo.BoundingBox;
import com.unihack8.backend.common.geo.GeoPoint;
import com.unihack8.backend.common.security.CurrentUser;
import com.unihack8.backend.help.domain.dto.CreateHelpRequest;
import com.unihack8.backend.help.domain.dto.HelpRequestDetail;
import com.unihack8.backend.help.domain.dto.HelpRequestSummary;
import com.unihack8.backend.help.domain.dto.HelpTicketResponse;
import com.unihack8.backend.help.domain.dto.MyHelpResponse;
import com.unihack8.backend.help.domain.dto.WithdrawResponse;
import com.unihack8.backend.help.service.HelpService;
import com.unihack8.backend.reliability.domain.dto.CheckInRequest;
import com.unihack8.backend.reliability.domain.dto.CheckInResponse;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** Neighbour Help Board endpoints (PLAN 25, docs/API.md). Every endpoint needs a signed-in caller. */
@RestController
@RequestMapping("/help-requests")
public class HelpController {

    private final HelpService help;
    private final CurrentUser currentUser;

    // Needs the help service and the current-user helper.
    public HelpController(HelpService help, CurrentUser currentUser) {
        this.help = help;
        this.currentUser = currentUser;
    }

    // GET /help-requests — open requests; near=lat,lon sorts nearest first, bbox=minLon,minLat,maxLon,maxLat
    // keeps one area (used by Neighbourhood Pulse).
    @GetMapping
    public List<HelpRequestSummary> board(@RequestParam(required = false) String near,
                                          @RequestParam(required = false) String bbox) {
        return help.board(currentUser.id(), near == null ? null : GeoPoint.parse(near, "near"),
                bbox == null ? null : BoundingBox.parse(bbox, "bbox"));
    }

    // GET /help-requests/mine — what the caller asked for and offered on.
    @GetMapping("/mine")
    public MyHelpResponse mine() {
        return help.mine(currentUser.id());
    }

    // POST /help-requests — post a new request (open for 24 hours).
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public HelpRequestDetail create(@RequestBody CreateHelpRequest request) {
        return help.create(currentUser.id(), request);
    }

    // GET /help-requests/{id} — details with every offer.
    @GetMapping("/{id}")
    public HelpRequestDetail detail(@PathVariable UUID id) {
        return help.detail(id, currentUser.id());
    }

    // DELETE /help-requests/{id} — the requester cancels.
    @DeleteMapping("/{id}")
    public HelpRequestDetail cancel(@PathVariable UUID id) {
        return help.cancel(id, currentUser.id());
    }

    // POST /help-requests/{id}/offers — offer to help.
    @PostMapping("/{id}/offers")
    @ResponseStatus(HttpStatus.CREATED)
    public HelpTicketResponse offer(@PathVariable UUID id) {
        return help.offer(id, currentUser.id());
    }

    // DELETE /help-requests/{id}/offers/me — withdraw the caller's offer.
    @DeleteMapping("/{id}/offers/me")
    public WithdrawResponse withdraw(@PathVariable UUID id) {
        return help.withdraw(id, currentUser.id());
    }

    // GET /help-requests/{id}/my-ticket — the helper's QR token.
    @GetMapping("/{id}/my-ticket")
    public HelpTicketResponse myTicket(@PathVariable UUID id) {
        return help.myTicket(id, currentUser.id());
    }

    // POST /help-requests/{id}/check-in — the requester scanned a helper's QR code.
    @PostMapping("/{id}/check-in")
    public CheckInResponse checkIn(@PathVariable UUID id, @Valid @RequestBody CheckInRequest request) {
        return help.checkIn(id, currentUser.id(), request.token());
    }
}
