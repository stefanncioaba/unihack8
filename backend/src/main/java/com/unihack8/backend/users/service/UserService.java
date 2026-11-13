package com.unihack8.backend.users.service;

import com.unihack8.backend.users.domain.dto.ProfileResponse;
import com.unihack8.backend.users.domain.dto.ProfileSearchResult;
import com.unihack8.backend.users.domain.dto.UsernameAvailabilityResponse;

import java.util.List;
import java.util.UUID;

public interface UserService {
    // Gets a profile (the caller's own or a public one) with its attended events; 404 if it does not exist.
    ProfileResponse getProfile(UUID userId);

    // Changes the caller's username; 400 INVALID_USERNAME or 409 USERNAME_TAKEN when it cannot be used.
    ProfileResponse updateUsername(UUID userId, String username);

    // Finds up to 20 users by case-insensitive username prefix.
    List<ProfileSearchResult> search(String query);

    // Tells whether a username is free (public, used before sign-up); 400 INVALID_USERNAME for a bad format.
    UsernameAvailabilityResponse checkUsername(String username);
}
