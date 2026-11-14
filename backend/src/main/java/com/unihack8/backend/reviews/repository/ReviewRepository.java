package com.unihack8.backend.reviews.repository;

import com.unihack8.backend.reviews.domain.dto.RatingStats;
import com.unihack8.backend.reviews.domain.entity.EventReview;
import com.unihack8.backend.reviews.domain.entity.SettlementCandidate;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/** Review storage and the organiser rating settlement bookkeeping. */
public interface ReviewRepository {
    // The caller's review of an event, if they wrote one.
    Optional<EventReview> find(UUID eventId, UUID reviewerId);

    // Stores a new review.
    void insert(EventReview review);

    // Replaces the rating and comment of an existing review.
    void update(EventReview review);

    // All reviews of an event, most recently updated first.
    List<EventReview> forEvent(UUID eventId);

    // Average and count for one event.
    RatingStats stats(UUID eventId);

    // Average and count for many events; events without reviews are missing from the map.
    Map<UUID, RatingStats> stats(List<UUID> eventIds);

    // Whether the organiser's rating points were already applied.
    boolean isSettled(UUID eventId);

    // Unsettled user events that started before the given time.
    List<SettlementCandidate> unsettledStartedBefore(Instant time);

    // Marks an event settled only if it was not yet; returns 1 when this call settled it.
    int markSettled(UUID eventId, Instant settledAt);
}
