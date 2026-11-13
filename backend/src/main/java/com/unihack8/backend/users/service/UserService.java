package com.unihack8.backend.users.service;

import com.unihack8.backend.users.domain.dto.ProfileResponse;
import com.unihack8.backend.users.domain.dto.ProfileSearchResult;

import java.util.List;
import java.util.UUID;

public interface UserService {
    // Gets the caller's profile.
    ProfileResponse getOwnProfile(UUID userId);

    // Changes the caller's username when it is available.
    ProfileResponse updateUsername(UUID userId, String username);

    // Finds up to 20 users by username prefix.
    List<ProfileSearchResult> search(String query);

    // Gets another user's public profile.
    ProfileResponse getPublicProfile(UUID userId);
}
