package com.unihack8.backend.users.repository;

import com.unihack8.backend.users.domain.entity.Profile;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface ProfileRepository extends JpaRepository<Profile, UUID> {
    // Checks uniqueness before changing a username.
    boolean existsByUsernameIgnoreCaseAndIdNot(String username, UUID id);

    // Checks whether anyone owns the username (sign-up screen), ignoring case.
    boolean existsByUsernameIgnoreCase(String username);

    // Finds a bounded page of usernames beginning with the query.
    List<Profile> findByUsernameStartingWithIgnoreCase(String username, Pageable pageable);
}
