package com.unihack8.backend.events.repository;

import com.unihack8.backend.events.domain.entity.EventParticipant;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** Participation and reliability persistence. */
public interface ParticipationRepository {
    // Finds the caller's state for an event.
    Optional<EventParticipant> find(UUID eventId, UUID userId);

    // Creates the participant with a random stable QR token.
    void insert(EventParticipant participant);

    // Changes a participant's status without rotating the ticket token.
    void status(UUID eventId, UUID userId, String status);

    // Lists participants except those who cancelled.
    List<EventParticipant> participants(UUID eventId);

    // Lists a user's joined events except cancellations.
    List<EventParticipant> joinedBy(UUID userId);

    // Applies a bounded reliability change and records its reason.
    int changeReliability(UUID userId, UUID eventId, int points, String reason, Instant changedAt);
}
