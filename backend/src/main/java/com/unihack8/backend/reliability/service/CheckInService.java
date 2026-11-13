package com.unihack8.backend.reliability.service;

import com.unihack8.backend.reliability.domain.dto.CheckInResponse;
import com.unihack8.backend.reliability.domain.dto.TicketResponse;
import java.util.UUID;

/** QR tickets and organiser check-in (PLAN 6.1, 6.2). */
public interface CheckInService {

    // The caller's ticket for an event; 409 NOT_JOINED when not in it, 403 BANNED when banned.
    TicketResponse myTicket(UUID eventId, UUID caller);

    // The organiser scans a participant's QR token: marks ATTENDED and adds the attendance points.
    CheckInResponse checkIn(UUID eventId, UUID organizer, String token);
}
