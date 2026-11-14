package com.unihack8.backend.help.service;

import com.unihack8.backend.common.geo.BoundingBox;
import com.unihack8.backend.common.geo.GeoPoint;
import com.unihack8.backend.help.domain.dto.CreateHelpRequest;
import com.unihack8.backend.help.domain.dto.HelpRequestDetail;
import com.unihack8.backend.help.domain.dto.HelpRequestSummary;
import com.unihack8.backend.help.domain.dto.HelpTicketResponse;
import com.unihack8.backend.help.domain.dto.MyHelpResponse;
import com.unihack8.backend.help.domain.dto.WithdrawResponse;
import com.unihack8.backend.reliability.domain.dto.CheckInResponse;
import java.util.List;
import java.util.UUID;

/** Neighbour Help Board rules (PLAN 25, docs/API.md -> Neighbour Help Board). */
public interface HelpService {

    // The board: open requests, newest first, or nearest first when `near` is given; `bbox` limits it to an
    // area (e.g. a neighbourhood). Both may be null.
    List<HelpRequestSummary> board(UUID caller, GeoPoint near, BoundingBox bbox);

    // The caller's own requests and the requests they offered on.
    MyHelpResponse mine(UUID caller);

    // Posts a new request that stays open for 24 hours.
    HelpRequestDetail create(UUID caller, CreateHelpRequest request);

    // One request with its offers, as seen by the caller.
    HelpRequestDetail detail(UUID id, UUID caller);

    // The requester cancels their open request (free).
    HelpRequestDetail cancel(UUID id, UUID caller);

    // The caller offers to help (or offers again after withdrawing, with the same QR token).
    HelpTicketResponse offer(UUID id, UUID caller);

    // The caller withdraws their offer (free).
    WithdrawResponse withdraw(UUID id, UUID caller);

    // The caller's QR ticket for this request.
    HelpTicketResponse myTicket(UUID id, UUID caller);

    // The requester scans a helper's QR code: closes the request and gives that helper +5.
    CheckInResponse checkIn(UUID id, UUID caller, String token);
}
