package com.unihack8.backend.help.domain;

import static org.assertj.core.api.Assertions.assertThat;

import com.unihack8.backend.reliability.domain.ReliabilityRules;
import java.time.Duration;
import java.time.Instant;
import org.junit.jupiter.api.Test;

/** The 24-hour lifetime and the computed EXPIRED status. */
class HelpRulesTest {

    private static final Instant POSTED = Instant.parse("2026-11-14T10:00:00Z");

    // A request expires exactly 24 hours after it was posted.
    @Test
    void expiresAfter24Hours() {
        assertThat(HelpRules.expiresAt(POSTED)).isEqualTo(Instant.parse("2026-11-15T10:00:00Z"));
    }

    // OPEN stays OPEN until the expiry moment, then shows as EXPIRED; closed statuses never change.
    @Test
    void effectiveStatus() {
        Instant expires = HelpRules.expiresAt(POSTED);
        assertThat(HelpRules.effectiveStatus("OPEN", expires, expires.minusSeconds(1))).isEqualTo("OPEN");
        assertThat(HelpRules.effectiveStatus("OPEN", expires, expires)).isEqualTo("EXPIRED");
        assertThat(HelpRules.effectiveStatus("HELPED", expires, expires.plus(Duration.ofDays(2)))).isEqualTo("HELPED");
        assertThat(HelpRules.effectiveStatus("CANCELLED", expires, expires.plusSeconds(1))).isEqualTo("CANCELLED");
        assertThat(HelpRules.isOpen("OPEN", expires, POSTED)).isTrue();
        assertThat(HelpRules.isOpen("HELPED", expires, POSTED)).isFalse();
    }

    // The scanned helper gains the same +5 as event attendance.
    @Test
    void helperPointsMatchAttendance() {
        assertThat(ReliabilityRules.HELPED_POINTS).isEqualTo(5).isEqualTo(ReliabilityRules.ATTENDED_POINTS);
        assertThat(ReliabilityRules.HELPED_REASON).isEqualTo("HELPED");
    }

    // PLAN 28: 18 categories in display order, OTHER last; the set and the list agree.
    @Test
    void categoriesInOrder() {
        assertThat(HelpRules.CATEGORY_ORDER).containsExactly("BORROW", "CARRY", "PETS", "ERRANDS", "REPAIRS",
                "CARPENTRY", "PLUMBING", "ELECTRICAL", "PAINTING", "GARDENING", "CLEANING", "TECH", "TUTORING",
                "COOKING", "BIKES", "CARS", "ELDERLY", "OTHER");
        assertThat(HelpRules.CATEGORIES).containsExactlyInAnyOrderElementsOf(HelpRules.CATEGORY_ORDER);
        assertThat(HelpRules.CATEGORY_ORDER).allMatch(c -> c.length() <= 20);
    }
}
