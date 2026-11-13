package com.unihack8.backend.reliability.repository;

import com.unihack8.backend.events.domain.entity.EventParticipant;
import com.unihack8.backend.reliability.domain.entity.OverdueParticipant;
import com.unihack8.backend.reliability.domain.entity.ReliabilityLogEntry;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Check-in, no-show and reliability-history SQL (PLAN 6). Score changes themselves go through the
 * events feature's ParticipationRepository.changeReliability, so there is one place that applies them.
 */
public interface CheckInRepository {

    // The ticket with this QR token, in whichever event it belongs to.
    Optional<EventParticipant> findByToken(UUID qrToken);

    // JOINED -> ATTENDED with the check-in time; 0 when the row was no longer JOINED (scanned twice).
    int markAttended(UUID eventId, UUID userId, Instant checkedInAt);

    // Participants still JOINED in user events that started at or before `now`.
    List<OverdueParticipant> joinedInStartedEvents(Instant now);

    // JOINED -> NO_SHOW; 0 when the row was no longer JOINED (already handled).
    int markNoShow(UUID eventId, UUID userId);

    // The user's most recent reliability changes, newest first, with event titles.
    List<ReliabilityLogEntry> recentLog(UUID userId, int limit);
}
