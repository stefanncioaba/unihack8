package com.unihack8.backend.reviews.service.impl;

import com.unihack8.backend.common.exception.ApiException;
import com.unihack8.backend.common.exception.ErrorCode;
import com.unihack8.backend.events.domain.dto.UserSummary;
import com.unihack8.backend.events.domain.entity.Event;
import com.unihack8.backend.events.mapper.EventMapper;
import com.unihack8.backend.events.repository.EventRepository;
import com.unihack8.backend.events.repository.ParticipationRepository;
import com.unihack8.backend.reviews.domain.ReviewRules;
import com.unihack8.backend.reviews.domain.dto.EventReviewsResponse;
import com.unihack8.backend.reviews.domain.dto.RatingStats;
import com.unihack8.backend.reviews.domain.dto.ReviewRequest;
import com.unihack8.backend.reviews.domain.dto.ReviewResponse;
import com.unihack8.backend.reviews.domain.entity.EventReview;
import com.unihack8.backend.reviews.mapper.ReviewMapper;
import com.unihack8.backend.reviews.repository.ReviewRepository;
import com.unihack8.backend.reviews.service.ReviewService;
import com.unihack8.backend.users.domain.entity.Profile;
import com.unihack8.backend.users.repository.ProfileRepository;
import java.time.Clock;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Review rules (docs/API.md -> reviews): only participants the organiser checked in can rate, the
 * organiser cannot rate their own event, and reviews close 24 h after the event ends or once settled.
 * Saving locks the event row, so it cannot interleave with the settlement of the same event.
 */
@Service
public class ReviewServiceImpl implements ReviewService {
    private final EventRepository events;
    private final ParticipationRepository participations;
    private final ReviewRepository reviews;
    private final ProfileRepository profiles;
    private final EventMapper eventMapper;
    private final ReviewMapper mapper;
    private final Clock clock;

    // Reuses the events feature's storage for events, participants and public user summaries.
    public ReviewServiceImpl(EventRepository events, ParticipationRepository participations, ReviewRepository reviews,
            ProfileRepository profiles, EventMapper eventMapper, ReviewMapper mapper, Clock clock) {
        this.events = events;
        this.participations = participations;
        this.reviews = reviews;
        this.profiles = profiles;
        this.eventMapper = eventMapper;
        this.mapper = mapper;
        this.clock = clock;
    }

    // Lists every review with its author, the average, and whether the caller may (still) review.
    @Override
    @Transactional(readOnly = true)
    public EventReviewsResponse reviews(UUID eventId, Optional<UUID> caller) {
        Event event = events.find(eventId).orElseThrow(() -> ApiException.notFound("Event"));
        List<EventReview> all = reviews.forEvent(eventId);
        Map<UUID, UserSummary> authors = authors(all);
        List<ReviewResponse> list = all.stream()
                .filter(r -> authors.containsKey(r.reviewerId()))
                .map(r -> mapper.toResponse(r, authors.get(r.reviewerId()))).toList();
        RatingStats stats = reviews.stats(eventId);
        boolean userEvent = "USER".equals(event.source());
        boolean settled = userEvent && reviews.isSettled(eventId);
        Instant closesAt = userEvent ? ReviewRules.closesAt(event.startsAt(), event.endsAt()) : null;
        ReviewResponse mine = caller.flatMap(id -> list.stream().filter(r -> r.reviewer().id().equals(id)).findFirst())
                .orElse(null);
        boolean canReview = userEvent && !settled && caller.isPresent()
                && !caller.get().equals(event.organizerId())
                && clock.instant().isBefore(closesAt)
                && participations.find(eventId, caller.get()).map(p -> "ATTENDED".equals(p.status())).orElse(false);
        return new EventReviewsResponse(stats.rounded(), stats.count(), list, closesAt, settled, canReview, mine);
    }

    // Validates, checks the attendee and the review window, then inserts or replaces the review.
    @Override
    @Transactional
    public ReviewResponse save(UUID eventId, UUID caller, ReviewRequest request) {
        if (request == null || request.rating() == null
                || request.rating() < ReviewRules.MIN_RATING || request.rating() > ReviewRules.MAX_RATING) {
            throw invalid("rating must be a whole number from 1 to 5.");
        }
        String comment = request.comment() == null || request.comment().isBlank() ? null : request.comment().trim();
        if (comment != null && comment.length() > ReviewRules.MAX_COMMENT_LENGTH) {
            throw invalid("comment must be at most " + ReviewRules.MAX_COMMENT_LENGTH + " characters.");
        }
        Event event = events.lock(eventId).orElseThrow(() -> ApiException.notFound("Event"));
        if (!"USER".equals(event.source())) throw new ApiException(ErrorCode.EXTERNAL_EVENT);
        if (caller.equals(event.organizerId())) {
            throw new ApiException(ErrorCode.IS_ORGANIZER, "Organisers cannot review their own event.");
        }
        boolean attended = participations.find(eventId, caller).map(p -> "ATTENDED".equals(p.status())).orElse(false);
        if (!attended) throw new ApiException(ErrorCode.NOT_ATTENDED);
        Instant now = clock.instant();
        if (reviews.isSettled(eventId) || !now.isBefore(ReviewRules.closesAt(event.startsAt(), event.endsAt()))) {
            throw new ApiException(ErrorCode.REVIEWS_CLOSED);
        }
        Optional<EventReview> existing = reviews.find(eventId, caller);
        EventReview saved = new EventReview(eventId, caller, request.rating(), comment,
                existing.map(EventReview::createdAt).orElse(now), now);
        if (existing.isPresent()) {
            reviews.update(saved);
        } else {
            reviews.insert(saved);
        }
        Profile author = profiles.findById(caller).orElseThrow(() -> ApiException.notFound("User"));
        return mapper.toResponse(saved, eventMapper.user(author));
    }

    // Loads the reviewers' public summaries in one query.
    private Map<UUID, UserSummary> authors(List<EventReview> all) {
        Map<UUID, UserSummary> result = new HashMap<>();
        if (all.isEmpty()) return result;
        for (Profile p : profiles.findAllById(all.stream().map(EventReview::reviewerId).distinct().toList())) {
            result.put(p.getId(), eventMapper.user(p));
        }
        return result;
    }

    // Creates a contract-compatible 400 response.
    private static ApiException invalid(String message) {
        return new ApiException(ErrorCode.VALIDATION_FAILED, message);
    }
}
