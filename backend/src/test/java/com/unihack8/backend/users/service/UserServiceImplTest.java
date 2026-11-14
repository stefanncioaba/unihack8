package com.unihack8.backend.users.service;

import com.unihack8.backend.common.exception.ApiException;
import com.unihack8.backend.common.exception.ErrorCode;
import com.unihack8.backend.users.domain.dto.AttendedEventResponse;
import com.unihack8.backend.users.domain.entity.Profile;
import com.unihack8.backend.users.mapper.impl.ProfileMapperImpl;
import com.unihack8.backend.users.repository.AttendedEventRepository;
import com.unihack8.backend.users.repository.ProfileRepository;
import com.unihack8.backend.users.service.impl.UserServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Pageable;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** Service rules for PLAN 4, with the database mocked. */
@ExtendWith(MockitoExtension.class)
class UserServiceImplTest {
    private static final UUID USER_ID = UUID.fromString("11111111-1111-1111-1111-111111111111");
    private static final UUID EVENT_ID = UUID.fromString("22222222-2222-2222-2222-222222222222");
    private static final Instant NOW = Instant.parse("2026-11-14T15:00:00Z");

    @Mock
    private ProfileRepository profiles;

    @Mock
    private AttendedEventRepository attendedEvents;

    private UserServiceImpl service;

    // Wires the real mapper while keeping persistence independent of Supabase.
    @BeforeEach
    void setUp() {
        service = new UserServiceImpl(profiles, attendedEvents, new ProfileMapperImpl(), Clock.fixed(NOW, ZoneOffset.UTC));
    }

    // A profile includes confirmed event attendance.
    @Test
    void profileIncludesAttendedEvents() {
        when(profiles.findById(USER_ID)).thenReturn(Optional.of(profile()));
        when(attendedEvents.findAttendedByUserId(USER_ID)).thenReturn(List.of(attendedEvent()));

        var response = service.getProfile(USER_ID);

        assertEquals("alex_21", response.username());
        assertEquals(EVENT_ID, response.attendedEvents().getFirst().id());
    }

    // A missing profile answers 404 NOT_FOUND.
    @Test
    void missingProfileIsNotFound() {
        when(profiles.findById(USER_ID)).thenReturn(Optional.empty());

        assertEquals(ErrorCode.NOT_FOUND, codeOf(() -> service.getProfile(USER_ID)));
    }

    // The service rejects a case-insensitive username collision.
    @Test
    void rejectsTakenUsername() {
        when(profiles.findById(USER_ID)).thenReturn(Optional.of(profile()));
        when(profiles.existsByUsernameIgnoreCaseAndIdNot("Alex_New", USER_ID)).thenReturn(true);

        assertEquals(ErrorCode.USERNAME_TAKEN, codeOf(() -> service.updateUsername(USER_ID, "Alex_New")));
        verify(profiles, never()).saveAndFlush(any());
    }

    // A database uniqueness race must produce the same conflict as the precheck.
    @Test
    void rejectsConcurrentUsernameCollision() {
        Profile profile = profile();
        when(profiles.findById(USER_ID)).thenReturn(Optional.of(profile));
        when(profiles.saveAndFlush(profile)).thenThrow(new DataIntegrityViolationException("duplicate"));

        assertEquals(ErrorCode.USERNAME_TAKEN, codeOf(() -> service.updateUsername(USER_ID, "new_name")));
    }

    // A free username is saved and returned.
    @Test
    void changesUsername() {
        Profile profile = profile();
        when(profiles.findById(USER_ID)).thenReturn(Optional.of(profile));

        var response = service.updateUsername(USER_ID, "new_name");

        assertEquals("new_name", response.username());
        verify(profiles).saveAndFlush(profile);
    }

    // Bad usernames answer 400 INVALID_USERNAME before any database access.
    @Test
    void rejectsInvalidUsernames() {
        for (String bad : new String[] {null, "", "ab", "bad name", "dash-ed", "a".repeat(21)}) {
            assertEquals(ErrorCode.INVALID_USERNAME, codeOf(() -> service.updateUsername(USER_ID, bad)));
            assertEquals(ErrorCode.INVALID_USERNAME, codeOf(() -> service.checkUsername(bad)));
        }
        verify(profiles, never()).findById(any());
    }

    // The availability check says taken or free, ignoring case.
    @Test
    void checksUsernameAvailability() {
        when(profiles.existsByUsernameIgnoreCase("stefan")).thenReturn(true);
        when(profiles.existsByUsernameIgnoreCase("free_name")).thenReturn(false);

        assertFalse(service.checkUsername("stefan").available());
        assertTrue(service.checkUsername("free_name").available());
        assertEquals("free_name", service.checkUsername("free_name").username());
    }

    // Username search uses a fixed upper bound of 20 results.
    @Test
    void searchIsCappedAtTwenty() {
        when(profiles.findByUsernameStartingWithIgnoreCase(eq("alex"), any(Pageable.class)))
                .thenReturn(List.of(profile()));

        assertEquals(1, service.search(" alex ").size());
        ArgumentCaptor<Pageable> page = ArgumentCaptor.forClass(Pageable.class);
        verify(profiles).findByUsernameStartingWithIgnoreCase(eq("alex"), page.capture());
        assertEquals(20, page.getValue().getPageSize());
    }

    // Empty search terms cannot enumerate every account.
    @Test
    void searchRejectsEmptyQuery() {
        assertEquals(ErrorCode.VALIDATION_FAILED, codeOf(() -> service.search(" ")));
        assertEquals(ErrorCode.VALIDATION_FAILED, codeOf(() -> service.search(null)));
    }

    // Runs the call and returns the error code of the ApiException it throws.
    private ErrorCode codeOf(Runnable call) {
        return assertThrows(ApiException.class, call::run).code();
    }

    // Creates repeatable profile data for service scenarios.
    private Profile profile() {
        return new Profile(USER_ID, "alex_21", 100, Instant.parse("2026-11-13T10:00:00Z"));
    }

    // One attended event in the EventSummary shape.
    private AttendedEventResponse attendedEvent() {
        return new AttendedEventResponse(EVENT_ID, "USER", "Meetup", "MEETUP", "Cafe", 45.75, 21.23,
                Instant.parse("2026-11-12T18:00:00Z"), null, null, null, null, 12, 4, null, 0);
    }
}
