package com.unihack8.backend.users.service;

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

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class UserServiceImplTest {
    private static final UUID USER_ID = UUID.fromString("11111111-1111-1111-1111-111111111111");
    private static final UUID EVENT_ID = UUID.fromString("22222222-2222-2222-2222-222222222222");

    @Mock
    private ProfileRepository profiles;

    @Mock
    private AttendedEventRepository attendedEvents;

    private UserServiceImpl service;

    // Wires the real mapper while keeping persistence independent of Supabase.
    @BeforeEach
    void setUp() {
        service = new UserServiceImpl(profiles, attendedEvents, new ProfileMapperImpl());
    }

    // A public profile includes confirmed event attendance.
    @Test
    void publicProfileIncludesAttendedEvents() {
        when(profiles.findById(USER_ID)).thenReturn(Optional.of(profile()));
        when(attendedEvents.findAttendedByUserId(USER_ID)).thenReturn(List.of(
                new AttendedEventResponse(EVENT_ID, "Meetup", Instant.parse("2026-11-12T18:00:00Z"))));

        var response = service.getPublicProfile(USER_ID);

        assertEquals("alex_21", response.username());
        assertEquals(EVENT_ID, response.attendedEvents().getFirst().id());
    }

    // Missing profiles have a stable not-found outcome.
    @Test
    void missingProfileThrowsNotFound() {
        when(profiles.findById(USER_ID)).thenReturn(Optional.empty());
        assertThrows(UserNotFoundException.class, () -> service.getOwnProfile(USER_ID));
    }

    // The service rejects a case-insensitive username collision.
    @Test
    void rejectsTakenUsername() {
        when(profiles.findById(USER_ID)).thenReturn(Optional.of(profile()));
        when(profiles.existsByUsernameIgnoreCaseAndIdNot("Alex_New", USER_ID)).thenReturn(true);

        assertThrows(UsernameTakenException.class, () -> service.updateUsername(USER_ID, "Alex_New"));
    }

    // A database uniqueness race must produce the same conflict as a precheck.
    @Test
    void rejectsConcurrentUsernameCollision() {
        Profile profile = profile();
        when(profiles.findById(USER_ID)).thenReturn(Optional.of(profile));
        when(profiles.saveAndFlush(profile)).thenThrow(new DataIntegrityViolationException("duplicate"));

        assertThrows(UsernameTakenException.class, () -> service.updateUsername(USER_ID, "new_name"));
    }

    // Username search uses a fixed upper bound of 20 results.
    @Test
    void searchIsCappedAtTwenty() {
        when(profiles.findByUsernameStartingWithIgnoreCase(eq("alex"), any(Pageable.class)))
                .thenReturn(List.of(profile()));

        assertEquals(1, service.search("alex").size());
        ArgumentCaptor<Pageable> page = ArgumentCaptor.forClass(Pageable.class);
        verify(profiles).findByUsernameStartingWithIgnoreCase(eq("alex"), page.capture());
        assertEquals(20, page.getValue().getPageSize());
    }

    // Empty search terms cannot enumerate every account.
    @Test
    void searchRejectsEmptyQuery() {
        assertThrows(InvalidSearchException.class, () -> service.search(" "));
    }

    // Creates repeatable profile data for service scenarios.
    private Profile profile() {
        return new Profile(USER_ID, "alex_21", 100, Instant.parse("2026-11-13T10:00:00Z"));
    }
}
