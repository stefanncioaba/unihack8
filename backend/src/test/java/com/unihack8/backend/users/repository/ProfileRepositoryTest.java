package com.unihack8.backend.users.repository;

import com.unihack8.backend.users.domain.entity.Profile;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.data.domain.PageRequest;

import java.time.Instant;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

@DataJpaTest(properties = "spring.jpa.hibernate.ddl-auto=create-drop")
class ProfileRepositoryTest {
    @Autowired
    private ProfileRepository profiles;

    // Prefix search ignores case and treats underscores as literal username characters.
    @Test
    void searchesLiteralPrefixWithoutCase() {
        Profile first = profile("AL_one");
        profiles.saveAndFlush(first);
        profiles.saveAndFlush(profile("alex"));

        var matches = profiles.findByUsernameStartingWithIgnoreCase("al_", PageRequest.of(0, 20));

        assertEquals(1, matches.size());
        assertEquals(first.getId(), matches.getFirst().getId());
    }

    // Case-insensitive uniqueness checks exclude the current profile.
    @Test
    void checksOtherProfilesForUsernameConflict() {
        Profile first = profile("Alex_21");
        profiles.saveAndFlush(first);

        assertFalse(profiles.existsByUsernameIgnoreCaseAndIdNot("alex_21", first.getId()));
        assertTrue(profiles.existsByUsernameIgnoreCaseAndIdNot("ALEX_21", UUID.randomUUID()));
    }

    // Creates a profile row in the in-memory test database.
    private Profile profile(String username) {
        return new Profile(UUID.randomUUID(), username, 100, Instant.parse("2026-11-13T10:00:00Z"));
    }
}
