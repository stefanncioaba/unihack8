package com.unihack8.backend.events.service;

import com.unihack8.backend.common.exception.ApiException;
import com.unihack8.backend.common.exception.ErrorCode;
import com.unihack8.backend.events.domain.dto.CreateEventRequest;
import com.unihack8.backend.events.domain.dto.UpdateEventRequest;
import com.unihack8.backend.events.domain.entity.Event;
import com.unihack8.backend.events.domain.entity.EventParticipant;
import com.unihack8.backend.events.mapper.EventMapper;
import com.unihack8.backend.events.repository.EventRepository;
import com.unihack8.backend.events.repository.ParticipationRepository;
import com.unihack8.backend.events.service.impl.EventServiceImpl;
import com.unihack8.backend.users.domain.entity.Profile;
import com.unihack8.backend.users.repository.ProfileRepository;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** Service rules around capacity, participation, organizer authorization and time. */
@ExtendWith(MockitoExtension.class)
class EventServiceImplTest {
    private static final UUID EVENT = UUID.fromString("11111111-1111-1111-1111-111111111111");
    private static final UUID ORGANIZER = UUID.fromString("22222222-2222-2222-2222-222222222222");
    private static final UUID USER = UUID.fromString("33333333-3333-3333-3333-333333333333");
    private static final Instant NOW = Instant.parse("2026-11-14T15:00:00Z");
    @Mock private EventRepository events;
    @Mock private ParticipationRepository participants;
    @Mock private ProfileRepository profiles;
    @Mock private EventMapper mapper;
    private EventServiceImpl service;

    // Uses a fixed clock so all time-bound rules are deterministic.
    @BeforeEach
    void setUp() {
        service = new EventServiceImpl(events, participants, profiles, mapper, Clock.fixed(NOW, ZoneOffset.UTC));
    }

    // A user gets a ticket when one spot is still open.
    @Test
    void joinsAvailableEvent() {
        when(events.lock(EVENT)).thenReturn(Optional.of(event(1, NOW.plusSeconds(3600))));
        when(events.activeCount(EVENT)).thenReturn(0);
        var result = service.join(EVENT, USER);
        assertEquals("JOINED", result.status());
        assertNotNull(result.qrToken());
        verify(participants).insert(argThat(p -> p.userId().equals(USER) && p.qrToken().equals(result.qrToken())));
    }

    // A full event rejects the caller without inserting a ticket.
    @Test
    void rejectsFullEvent() {
        when(events.lock(EVENT)).thenReturn(Optional.of(event(1, NOW.plusSeconds(3600))));
        when(events.activeCount(EVENT)).thenReturn(1);
        assertCode(ErrorCode.EVENT_FULL, () -> service.join(EVENT, USER));
        verify(participants, never()).insert(any());
    }

    // Repeat joins and organizer self-joins have their documented codes.
    @Test
    void rejectsDuplicateAndOrganizerJoin() {
        when(events.lock(EVENT)).thenReturn(Optional.of(event(2, NOW.plusSeconds(3600))));
        when(participants.find(EVENT, USER)).thenReturn(Optional.of(participant("JOINED")));
        assertCode(ErrorCode.ALREADY_JOINED, () -> service.join(EVENT, USER));
        assertCode(ErrorCode.IS_ORGANIZER, () -> service.join(EVENT, ORGANIZER));
    }

    // A cancelled user reuses the original QR token when joining again.
    @Test
    void rejoinsAfterCancellationWithSameToken() {
        var old = participant("CANCELLED");
        when(events.lock(EVENT)).thenReturn(Optional.of(event(2, NOW.plusSeconds(3600))));
        when(participants.find(EVENT, USER)).thenReturn(Optional.of(old));
        assertEquals(old.qrToken(), service.join(EVENT, USER).qrToken());
        verify(participants).status(EVENT, USER, "JOINED");
        verify(participants, never()).insert(any());
    }

    // A ban survives later attempts to join.
    @Test
    void bannedUserCannotRejoin() {
        when(events.lock(EVENT)).thenReturn(Optional.of(event(2, NOW.plusSeconds(3600))));
        when(participants.find(EVENT, USER)).thenReturn(Optional.of(participant("BANNED")));
        assertCode(ErrorCode.BANNED, () -> service.join(EVENT, USER));
    }

    // Imported events cannot issue app tickets.
    @Test
    void externalEventCannotBeJoined() {
        when(events.lock(EVENT)).thenReturn(Optional.of(externalEvent()));
        assertCode(ErrorCode.EXTERNAL_EVENT, () -> service.join(EVENT, USER));
    }

    // Joining at or after the start time is too late.
    @Test
    void rejectsJoinAfterStart() {
        when(events.lock(EVENT)).thenReturn(Optional.of(event(2, NOW)));
        assertCode(ErrorCode.EVENT_ENDED, () -> service.join(EVENT, USER));
    }

    // Leaving inside two hours writes the agreed -2 reliability rule.
    @Test
    void lateLeaveDeductsPoints() {
        when(events.lock(EVENT)).thenReturn(Optional.of(event(2, NOW.plusSeconds(3600))));
        when(participants.find(EVENT, USER)).thenReturn(Optional.of(participant("JOINED")));
        when(participants.changeReliability(USER, EVENT, -2, "LATE_CANCEL", NOW)).thenReturn(98);
        var result = service.leave(EVENT, USER);
        assertEquals(-2, result.pointsChange());
        assertEquals(98, result.reliabilityScore());
        verify(participants).status(EVENT, USER, "CANCELLED");
    }

    // Early cancellations do not write a reliability entry.
    @Test
    void earlyLeaveDoesNotDeductPoints() {
        when(events.lock(EVENT)).thenReturn(Optional.of(event(2, NOW.plusSeconds(10800))));
        when(participants.find(EVENT, USER)).thenReturn(Optional.of(participant("JOINED")));
        when(profiles.findById(USER)).thenReturn(Optional.of(profile(USER, 100)));
        assertEquals(0, service.leave(EVENT, USER).pointsChange());
        verify(participants, never()).changeReliability(any(), any(), anyInt(), anyString(), any());
    }

    // Only the event owner can ban; the ban frees a joined spot.
    @Test
    void organizerOnlyBan() {
        when(events.lock(EVENT)).thenReturn(Optional.of(event(2, NOW.plusSeconds(3600))));
        assertCode(ErrorCode.NOT_ORGANIZER, () -> service.ban(EVENT, USER, ORGANIZER));
        when(participants.find(EVENT, USER)).thenReturn(Optional.of(participant("JOINED")));
        assertEquals("BANNED", service.ban(EVENT, ORGANIZER, USER).status());
        verify(participants).status(EVENT, USER, "BANNED");
    }

    // A checked-in participant keeps their attendance and cannot be banned.
    @Test
    void checkedInParticipantCannotBeBanned() {
        when(events.lock(EVENT)).thenReturn(Optional.of(event(2, NOW.plusSeconds(3600))));
        when(participants.find(EVENT, USER)).thenReturn(Optional.of(participant("ATTENDED")));
        assertCode(ErrorCode.ALREADY_CHECKED_IN, () -> service.ban(EVENT, ORGANIZER, USER));
        verify(participants, never()).status(any(), any(), anyString());
    }

    // An organizer cannot shrink capacity below occupied spots.
    @Test
    void rejectsCapacityBelowActiveCount() {
        when(events.lock(EVENT)).thenReturn(Optional.of(event(3, NOW.plusSeconds(3600))));
        when(events.activeCount(EVENT)).thenReturn(2);
        var patch = new UpdateEventRequest(Map.of("capacity", 1));
        assertCode(ErrorCode.VALIDATION_FAILED, () -> service.update(EVENT, ORGANIZER, patch));
        verify(events, never()).update(any());
    }

    // A JSON null PATCH body is a validation error, not an internal server error.
    @Test
    void rejectsNullPatchBody() {
        when(events.lock(EVENT)).thenReturn(Optional.of(event(2, NOW.plusSeconds(3600))));
        assertCode(ErrorCode.VALIDATION_FAILED,
                () -> service.update(EVENT, ORGANIZER, new UpdateEventRequest(null)));
    }

    // Cancelled participation is hidden; a ban is visible so the app explains why joining fails.
    @Test
    void detailShowsBanButHidesCancellation() {
        when(events.find(EVENT)).thenReturn(Optional.of(event(2, NOW.plusSeconds(3600))));
        when(profiles.findById(ORGANIZER)).thenReturn(Optional.of(profile(ORGANIZER, 100)));
        when(participants.find(EVENT, USER)).thenReturn(Optional.of(participant("CANCELLED")))
                .thenReturn(Optional.of(participant("BANNED")));
        service.detail(EVENT, Optional.of(USER));
        service.detail(EVENT, Optional.of(USER));
        verify(mapper).detail(any(), anyInt(), any(), isNull());
        verify(mapper).detail(any(), anyInt(), any(), eq("BANNED"));
    }

    // Imported detail does not disclose an organizer even if a legacy row contains one.
    @Test
    void externalDetailHasNoOrganizer() {
        when(events.find(EVENT)).thenReturn(Optional.of(externalEvent()));
        service.detail(EVENT, Optional.empty());
        verify(mapper).detail(any(), anyInt(), isNull(), isNull());
        verifyNoInteractions(profiles);
    }

    // Event creation rejects invalid dates before a database write.
    @Test
    void rejectsPastEvent() {
        var request = new CreateEventRequest("Meetup", null, "MEETUP", "Hall", null,
                45.7, 21.2, NOW.minusSeconds(1), null, null);
        assertCode(ErrorCode.VALIDATION_FAILED, () -> service.create(ORGANIZER, request));
        verify(events, never()).insert(any());
    }

    // Asserts the stable API error code produced by a rule.
    private void assertCode(ErrorCode expected, Runnable action) {
        ApiException error = assertThrows(ApiException.class, action::run);
        assertEquals(expected, error.code());
    }

    // Creates a representative user event with one required location.
    private Event event(Integer capacity, Instant startsAt) {
        return new Event(EVENT, "USER", null, "Meetup", null, "MEETUP", "Hall", null,
                45.7, 21.2, startsAt, startsAt.plusSeconds(7200), capacity, ORGANIZER,
                null, null, null, null, NOW);
    }

    // Creates an imported event with deliberately inconsistent legacy organizer data.
    private Event externalEvent() {
        return new Event(EVENT, "EXTERNAL", "source:1", "Concert", null, "CONCERT", "Hall", null,
                45.7, 21.2, NOW.plusSeconds(3600), null, 2, ORGANIZER,
                null, null, null, "https://example.com", NOW);
    }

    // Creates a participant in the requested lifecycle state.
    private EventParticipant participant(String status) {
        return new EventParticipant(EVENT, USER, status, UUID.randomUUID(), NOW.minusSeconds(60), null);
    }

    // Creates a profile for the no-penalty cancellation path.
    private Profile profile(UUID id, int score) {
        return new Profile(id, "user", score, NOW);
    }
}
