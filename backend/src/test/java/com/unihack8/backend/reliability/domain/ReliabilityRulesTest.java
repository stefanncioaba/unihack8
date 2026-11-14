package com.unihack8.backend.reliability.domain;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

/** Unit tests for the volunteer check-in bonus rule. */
class ReliabilityRulesTest {

    // Only the VOLUNTEER category earns the +5 bonus.
    @Test
    void bonusOnlyForVolunteerEvents() {
        assertThat(ReliabilityRules.checkInBonus("VOLUNTEER")).isEqualTo(5);
        assertThat(ReliabilityRules.checkInBonus("PARTY")).isZero();
        assertThat(ReliabilityRules.checkInBonus(null)).isZero();
    }
}
