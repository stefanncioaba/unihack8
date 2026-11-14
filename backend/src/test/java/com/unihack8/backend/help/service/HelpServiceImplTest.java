package com.unihack8.backend.help.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.unihack8.backend.common.exception.ApiException;
import com.unihack8.backend.common.exception.ErrorCode;
import com.unihack8.backend.events.repository.ParticipationRepository;
import com.unihack8.backend.help.domain.dto.CreateHelpRequest;
import com.unihack8.backend.help.domain.entity.HelpOffer;
import com.unihack8.backend.help.domain.entity.HelpRequest;
import com.unihack8.backend.help.mapper.impl.HelpMapperImpl;
import com.unihack8.backend.help.repository.HelpOfferRepository;
import com.unihack8.backend.help.repository.HelpRequestRepository;
import com.unihack8.backend.help.service.impl.HelpServiceImpl;
import com.unihack8.backend.users.domain.entity.Profile;
import com.unihack8.backend.users.repository.ProfileRepository;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.Mockito;
import org.mockito.junit.jupiter.MockitoExtension;

/** Help board rules with the database mocked: races, refusals and that only the scanned helper scores. */
@ExtendWith(MockitoExtension.class)
class HelpServiceImplTest {

    private static final UUID REQUEST = UUID.fromString("44444444-4444-4444-4444-444444444444");
    private static final UUID ASKER = UUID.fromString("55555555-5555-5555-5555-555555555555");
    private static final UUID HELPER = UUID.fromString("66666666-6666-6666-6666-666666666666");
    private static final Instant NOW = Instant.parse("2026-11-14T15:00:00Z");

    @Mock private HelpRequestRepository requests;
    @Mock private HelpOfferRepository offers;
    @Mock private ParticipationRepository participations;
    @Mock private ProfileRepository profiles;
    private HelpServiceImpl service;

    // Real mapper, fixed clock.
    @BeforeEach
    void setUp() {
        service = new HelpServiceImpl(requests, offers, participations, profiles, new HelpMapperImpl(),
                Clock.fixed(NOW, ZoneOffset.UTC));
    }

    // A stored request posted `ago` before now with this status.
    private static HelpRequest request(String status, Duration ago) {
        Instant created = NOW.minus(ago);
        return new HelpRequest(REQUEST, ASKER, "Borrow a ladder", null, "BORROW", null, null, null, status, created,
                created.plus(Duration.ofHours(24)), "OPEN".equals(status) ? null : NOW, null);
    }

    // The request row the service locks.
    private void locked(HelpRequest request) {
        when(requests.lock(REQUEST)).thenReturn(Optional.of(request));
    }

    // An offer by HELPER in this status.
    private static HelpOffer offer(String status) {
        return new HelpOffer(REQUEST, HELPER, status, UUID.randomUUID(), NOW.minusSeconds(600), null);
    }

    // Asserts the call fails with this error code.
    private static void fails(Runnable call, ErrorCode code) {
        assertThatThrownBy(call::run).isInstanceOf(ApiException.class)
                .satisfies(e -> assertThat(((ApiException) e).code()).isEqualTo(code));
    }

    // The first scan: helper HELPED, others NOT_NEEDED, request closed, +5 only for the helper.
    @Test
    void checkInClosesAndRewardsOnlyTheHelper() {
        locked(request("OPEN", Duration.ofHours(1)));
        HelpOffer offer = offer("OFFERED");
        when(offers.findByToken(offer.qrToken())).thenReturn(Optional.of(offer));
        when(offers.markHelped(REQUEST, HELPER, NOW)).thenReturn(1);
        when(requests.close(REQUEST, HELPER, NOW)).thenReturn(1);
        when(participations.changeReliability(HELPER, null, 5, "HELPED", NOW)).thenReturn(105);
        Profile profile = Mockito.mock(Profile.class);
        when(profile.getId()).thenReturn(HELPER);
        when(profile.getUsername()).thenReturn("stella");
        when(profiles.findById(HELPER)).thenReturn(Optional.of(profile));

        var answer = service.checkIn(REQUEST, ASKER, offer.qrToken().toString());

        assertThat(answer.status()).isEqualTo("HELPED");
        assertThat(answer.pointsChange()).isEqualTo(5);
        assertThat(answer.user().reliabilityScore()).isEqualTo(105);
        verify(offers).markOthersNotNeeded(REQUEST, HELPER);
        verify(participations).changeReliability(HELPER, null, 5, "HELPED", NOW);
        verify(participations, never()).changeReliability(eq(ASKER), any(), anyInt(), anyString(), any());
    }

    // A scan that loses the race (offer no longer OFFERED) is HELP_CLOSED and gives no points.
    @Test
    void lostRaceGivesNoPoints() {
        locked(request("OPEN", Duration.ofHours(1)));
        HelpOffer offer = offer("OFFERED");
        when(offers.findByToken(offer.qrToken())).thenReturn(Optional.of(offer));
        when(offers.markHelped(REQUEST, HELPER, NOW)).thenReturn(0);

        fails(() -> service.checkIn(REQUEST, ASKER, offer.qrToken().toString()), ErrorCode.HELP_CLOSED);
        verify(participations, never()).changeReliability(any(), isNull(), anyInt(), anyString(), any());
    }

    // Scanning after 24 hours, or by someone else, is refused before any token lookup.
    @Test
    void checkInRefusals() {
        locked(request("OPEN", Duration.ofHours(25)));
        fails(() -> service.checkIn(REQUEST, ASKER, UUID.randomUUID().toString()), ErrorCode.HELP_CLOSED);
        fails(() -> service.checkIn(REQUEST, HELPER, UUID.randomUUID().toString()), ErrorCode.NOT_REQUESTER);
        verify(offers, never()).findByToken(any());
    }

    // Offering on a closed request, or twice, is refused; a withdrawn offer comes back with its token.
    @Test
    void offerRules() {
        locked(request("HELPED", Duration.ofHours(1)));
        fails(() -> service.offer(REQUEST, HELPER), ErrorCode.HELP_CLOSED);

        locked(request("OPEN", Duration.ofHours(1)));
        when(offers.find(REQUEST, HELPER)).thenReturn(Optional.of(offer("OFFERED")));
        fails(() -> service.offer(REQUEST, HELPER), ErrorCode.ALREADY_OFFERED);

        HelpOffer withdrawn = offer("WITHDRAWN");
        when(offers.find(REQUEST, HELPER)).thenReturn(Optional.of(withdrawn));
        assertThat(service.offer(REQUEST, HELPER).qrToken()).isEqualTo(withdrawn.qrToken());
        verify(offers).changeStatus(REQUEST, HELPER, "WITHDRAWN", "OFFERED");
    }

    // Withdrawing without a current offer is NOT_OFFERED; withdrawing never touches points.
    @Test
    void withdrawRules() {
        locked(request("OPEN", Duration.ofHours(1)));
        when(offers.changeStatus(REQUEST, HELPER, "OFFERED", "WITHDRAWN")).thenReturn(0);
        fails(() -> service.withdraw(REQUEST, HELPER), ErrorCode.NOT_OFFERED);
        verify(participations, never()).changeReliability(any(), any(), anyInt(), anyString(), any());
    }

    // Only the requester cancels, only while open.
    @Test
    void cancelRules() {
        locked(request("OPEN", Duration.ofHours(1)));
        fails(() -> service.cancel(REQUEST, HELPER), ErrorCode.NOT_REQUESTER);
        locked(request("CANCELLED", Duration.ofHours(1)));
        fails(() -> service.cancel(REQUEST, ASKER), ErrorCode.HELP_CLOSED);
    }

    // Validation messages for title, category and half a location.
    @Test
    void createValidation() {
        fails(() -> service.create(ASKER, null), ErrorCode.VALIDATION_FAILED);
        fails(() -> service.create(ASKER, new CreateHelpRequest("  ab ", null, "BORROW", null, null, null)),
                ErrorCode.VALIDATION_FAILED);
        fails(() -> service.create(ASKER, new CreateHelpRequest("x".repeat(81), null, "BORROW", null, null, null)),
                ErrorCode.VALIDATION_FAILED);
        fails(() -> service.create(ASKER, new CreateHelpRequest("Walk my dog", null, null, null, null, null)),
                ErrorCode.VALIDATION_FAILED);
        fails(() -> service.create(ASKER, new CreateHelpRequest("Walk my dog", null, "PETS", null, null, 21.2)),
                ErrorCode.VALIDATION_FAILED);
        fails(() -> service.create(ASKER, new CreateHelpRequest("Walk my dog", null, "PETS", "x".repeat(121), null,
                null)), ErrorCode.VALIDATION_FAILED);
        verify(requests, never()).insert(any());
    }
}
