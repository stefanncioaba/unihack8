package com.unihack8.backend.reliability.service.impl;

import com.unihack8.backend.common.exception.ApiException;
import com.unihack8.backend.common.exception.ErrorCode;
import com.unihack8.backend.events.domain.dto.UserSummary;
import com.unihack8.backend.events.domain.entity.Event;
import com.unihack8.backend.events.domain.entity.EventParticipant;
import com.unihack8.backend.events.repository.EventRepository;
import com.unihack8.backend.events.repository.ParticipationRepository;
import com.unihack8.backend.reliability.domain.ReliabilityRules;
import com.unihack8.backend.reliability.domain.dto.CheckInResponse;
import com.unihack8.backend.reliability.domain.dto.TicketResponse;
import com.unihack8.backend.reliability.repository.CheckInRepository;
import com.unihack8.backend.reliability.service.CheckInService;
import com.unihack8.backend.users.domain.entity.Profile;
import com.unihack8.backend.users.repository.ProfileRepository;
import java.time.Clock;
import java.time.Instant;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Ticket and check-in rules (docs/API.md -> my-ticket, check-in). Check-in locks the event row, like
 * join and leave in the events feature, so two scans of the same ticket are handled one after the other.
 */
@Service
public class CheckInServiceImpl implements CheckInService {

    private final EventRepository events;
    private final ParticipationRepository participations;
    private final CheckInRepository checkIns;
    private final ProfileRepository profiles;
    private final Clock clock;

    // Reuses the events feature's event and participation storage.
    public CheckInServiceImpl(EventRepository events, ParticipationRepository participations,
                              CheckInRepository checkIns, ProfileRepository profiles, Clock clock) {
        this.events = events;
        this.participations = participations;
        this.checkIns = checkIns;
        this.profiles = profiles;
        this.clock = clock;
    }

    // Returns the caller's QR token while they are in the event (also after attending or a no-show).
    @Override
    @Transactional(readOnly = true)
    public TicketResponse myTicket(UUID eventId, UUID caller) {
        events.find(eventId).orElseThrow(() -> ApiException.notFound("Event"));
        EventParticipant ticket = participations.find(eventId, caller)
                .orElseThrow(() -> new ApiException(ErrorCode.NOT_JOINED));
        if ("BANNED".equals(ticket.status())) {
            throw new ApiException(ErrorCode.BANNED);
        }
        if ("CANCELLED".equals(ticket.status())) {
            throw new ApiException(ErrorCode.NOT_JOINED);
        }
        return new TicketResponse(eventId, ticket.qrToken(), ticket.status());
    }

    // Validates event, organiser, time and ticket, then marks ATTENDED and adds +5 exactly once.
    @Override
    @Transactional
    public CheckInResponse checkIn(UUID eventId, UUID organizer, String token) {
        Event event = events.lock(eventId).orElseThrow(() -> ApiException.notFound("Event"));
        if (!"USER".equals(event.source())) {
            throw new ApiException(ErrorCode.EXTERNAL_EVENT);
        }
        if (!organizer.equals(event.organizerId())) {
            throw new ApiException(ErrorCode.NOT_ORGANIZER);
        }
        Instant now = clock.instant();
        if (!now.isBefore(ReliabilityRules.effectiveEnd(event.startsAt(), event.endsAt()))) {
            throw new ApiException(ErrorCode.EVENT_ENDED);
        }
        EventParticipant ticket = checkIns.findByToken(parseToken(token))
                .orElseThrow(() -> new ApiException(ErrorCode.TICKET_NOT_FOUND));
        if (!eventId.equals(ticket.eventId())) {
            throw new ApiException(ErrorCode.WRONG_EVENT);
        }
        switch (ticket.status()) {
            case "ATTENDED" -> throw new ApiException(ErrorCode.ALREADY_CHECKED_IN);
            case "BANNED" -> throw new ApiException(ErrorCode.BANNED, "This participant was banned from the event.");
            case "CANCELLED" -> throw new ApiException(ErrorCode.NOT_JOINED, "This participant left the event.");
            case "NO_SHOW" -> throw new ApiException(ErrorCode.EVENT_ENDED);
            default -> {
                // JOINED: continue below.
            }
        }
        if (checkIns.markAttended(eventId, ticket.userId(), now) == 0) {
            throw new ApiException(ErrorCode.ALREADY_CHECKED_IN);
        }
        int score = participations.changeReliability(ticket.userId(), eventId, ReliabilityRules.ATTENDED_POINTS,
                ReliabilityRules.ATTENDED_REASON, now);
        Profile profile = profiles.findById(ticket.userId()).orElseThrow(() -> ApiException.notFound("User"));
        return new CheckInResponse(new UserSummary(profile.getId(), profile.getUsername(), score),
                "ATTENDED", ReliabilityRules.ATTENDED_POINTS);
    }

    // The scanned text must be a UUID; anything else is simply not one of our tickets.
    private static UUID parseToken(String token) {
        try {
            return UUID.fromString(token == null ? "" : token.trim());
        } catch (IllegalArgumentException e) {
            throw new ApiException(ErrorCode.TICKET_NOT_FOUND);
        }
    }
}
