package com.unihack8.backend.reviews.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.unihack8.backend.common.exception.ApiException;
import com.unihack8.backend.common.exception.ErrorCode;
import com.unihack8.backend.events.domain.entity.Event;
import com.unihack8.backend.events.domain.entity.EventParticipant;
import com.unihack8.backend.events.mapper.impl.EventMapperImpl;
import com.unihack8.backend.events.repository.EventRepository;
import com.unihack8.backend.events.repository.ParticipationRepository;
import com.unihack8.backend.reviews.domain.dto.RatingStats;
import com.unihack8.backend.reviews.domain.dto.ReviewRequest;
import com.unihack8.backend.reviews.domain.entity.EventReview;
import com.unihack8.backend.reviews.mapper.impl.ReviewMapperImpl;
import com.unihack8.backend.reviews.repository.ReviewRepository;
import com.unihack8.backend.reviews.service.impl.ReviewServiceImpl;
import com.unihack8.backend.users.domain.entity.Profile;
import com.unihack8.backend.users.repository.ProfileRepository;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

/** Review rules with the database mocked. */
@ExtendWith(MockitoExtension.class)
class ReviewServiceImplTest {
    private static final UUID EVENT = UUID.fromString("11111111-1111-1111-1111-111111111111");
    private static final UUID HOST = UUID.fromString("22222222-2222-2222-2222-222222222222");
    private static final UUID GUEST = UUID.fromString("33333333-3333-3333-3333-333333333333");
    private static final Instant NOW = Instant.parse("2026-11-14T15:00:00Z");
    @Mock private EventRepository events;
    @Mock private ParticipationRepository participations;
    @Mock private ReviewRepository reviews;
    @Mock private ProfileRepository profiles;
    private ReviewServiceImpl service;

    // Real mappers, fixed clock.
    @BeforeEach
    void setUp() {
        service = new ReviewServiceImpl(events, participations, reviews, profiles, new EventMapperImpl(),
                new ReviewMapperImpl(), Clock.fixed(NOW, ZoneOffset.UTC));
    }

    // A checked-in guest's first review is inserted with a trimmed comment.
    @Test
    void attendeeCreatesReview() {
        attendedOpenEvent();
        when(reviews.find(EVENT, GUEST)).thenReturn(Optional.empty());
        when(profiles.findById(GUEST)).thenReturn(Optional.of(new Profile(GUEST, "guest", 100, NOW)));
        var saved = service.save(EVENT, GUEST, new ReviewRequest(4, "  fun  "));
        assertEquals(4, saved.rating());
        assertEquals("fun", saved.comment());
        assertEquals("guest", saved.reviewer().username());
        verify(reviews).insert(argThat(r -> r.rating() == 4 && r.createdAt().equals(NOW)));
    }

    // Saving again replaces the review but keeps its creation time; a blank comment becomes null.
    @Test
    void secondSaveUpdates() {
        attendedOpenEvent();
        Instant created = NOW.minusSeconds(600);
        when(reviews.find(EVENT, GUEST)).thenReturn(Optional.of(new EventReview(EVENT, GUEST, 2, "meh", created, created)));
        when(profiles.findById(GUEST)).thenReturn(Optional.of(new Profile(GUEST, "guest", 100, NOW)));
        var saved = service.save(EVENT, GUEST, new ReviewRequest(5, "   "));
        assertNull(saved.comment());
        verify(reviews).update(argThat(r -> r.rating() == 5 && r.createdAt().equals(created) && r.updatedAt().equals(NOW)));
        verify(reviews, never()).insert(any());
    }

    // Joined but not scanned is not enough.
    @Test
    void notCheckedInIsRejected() {
        when(events.lock(EVENT)).thenReturn(Optional.of(event(NOW.minusSeconds(3600), NOW.plusSeconds(3600), "USER")));
        when(participations.find(EVENT, GUEST)).thenReturn(Optional.of(participant("JOINED")));
        assertCode(ErrorCode.NOT_ATTENDED, () -> service.save(EVENT, GUEST, new ReviewRequest(5, null)));
    }

    // The organiser cannot rate their own event; imported events cannot be rated.
    @Test
    void organiserAndExternalAreRejected() {
        when(events.lock(EVENT)).thenReturn(Optional.of(event(NOW.minusSeconds(3600), null, "USER")))
                .thenReturn(Optional.of(event(NOW.minusSeconds(3600), null, "EXTERNAL")));
        assertCode(ErrorCode.IS_ORGANIZER, () -> service.save(EVENT, HOST, new ReviewRequest(5, null)));
        assertCode(ErrorCode.EXTERNAL_EVENT, () -> service.save(EVENT, GUEST, new ReviewRequest(5, null)));
    }

    // After end + 24 h, or once settled, reviews are closed.
    @Test
    void closedWindowIsRejected() {
        when(events.lock(EVENT)).thenReturn(Optional.of(event(NOW.minus(Duration.ofHours(30)), NOW.minus(Duration.ofHours(25)), "USER")));
        when(participations.find(EVENT, GUEST)).thenReturn(Optional.of(participant("ATTENDED")));
        assertCode(ErrorCode.REVIEWS_CLOSED, () -> service.save(EVENT, GUEST, new ReviewRequest(5, null)));
    }

    // Ratings outside 1-5 and comments over 300 characters fail validation before any lookup.
    @Test
    void invalidInputIsRejected() {
        assertCode(ErrorCode.VALIDATION_FAILED, () -> service.save(EVENT, GUEST, new ReviewRequest(null, null)));
        assertCode(ErrorCode.VALIDATION_FAILED, () -> service.save(EVENT, GUEST, new ReviewRequest(0, null)));
        assertCode(ErrorCode.VALIDATION_FAILED, () -> service.save(EVENT, GUEST, new ReviewRequest(6, null)));
        assertCode(ErrorCode.VALIDATION_FAILED, () -> service.save(EVENT, GUEST, new ReviewRequest(3, "x".repeat(301))));
        verify(events, never()).lock(any());
    }

    // The list carries the average, the caller's own review and canReview.
    @Test
    void listShowsAverageAndCallerState() {
        when(events.find(EVENT)).thenReturn(Optional.of(event(NOW.minusSeconds(3600), NOW.plusSeconds(3600), "USER")));
        EventReview mine = new EventReview(EVENT, GUEST, 4, "ok", NOW, NOW);
        when(reviews.forEvent(EVENT)).thenReturn(List.of(mine));
        when(profiles.findAllById(List.of(GUEST))).thenReturn(List.of(new Profile(GUEST, "guest", 100, NOW)));
        when(reviews.stats(EVENT)).thenReturn(new RatingStats(4.0, 1));
        when(reviews.isSettled(EVENT)).thenReturn(false);
        when(participations.find(EVENT, GUEST)).thenReturn(Optional.of(participant("ATTENDED")));
        var answer = service.reviews(EVENT, Optional.of(GUEST));
        assertEquals(4.0, answer.averageRating());
        assertEquals(1, answer.reviewCount());
        assertEquals("guest", answer.myReview().reviewer().username());
        assertTrue(answer.canReview());
        assertEquals(NOW.plus(Duration.ofHours(25)), answer.reviewsCloseAt());
        var anonymous = service.reviews(EVENT, Optional.empty());
        assertFalse(anonymous.canReview());
        assertNull(anonymous.myReview());
    }

    // An open user event with GUEST checked in.
    private void attendedOpenEvent() {
        when(events.lock(EVENT)).thenReturn(Optional.of(event(NOW.minusSeconds(3600), NOW.plusSeconds(3600), "USER")));
        when(participations.find(EVENT, GUEST)).thenReturn(Optional.of(participant("ATTENDED")));
        when(reviews.isSettled(EVENT)).thenReturn(false);
    }

    // Event organised by HOST.
    private static Event event(Instant starts, Instant ends, String source) {
        return new Event(EVENT, source, "USER".equals(source) ? null : "x:1", "Meetup", null, "MEETUP", "Hall", null,
                45.7, 21.2, starts, ends, null, HOST, null, null, null, null, NOW.minusSeconds(86400));
    }

    // GUEST's participation row with a status.
    private static EventParticipant participant(String status) {
        return new EventParticipant(EVENT, GUEST, status, UUID.randomUUID(), NOW.minusSeconds(7200),
                "ATTENDED".equals(status) ? NOW.minusSeconds(60) : null);
    }

    // Asserts the call fails with the given API error code.
    private static void assertCode(ErrorCode code, Runnable call) {
        ApiException error = assertThrows(ApiException.class, call::run);
        assertEquals(code, error.code());
    }
}
