package com.unihack8.backend.users.service.impl;

import com.unihack8.backend.common.exception.ApiException;
import com.unihack8.backend.common.exception.ErrorCode;
import com.unihack8.backend.users.domain.dto.ProfileResponse;
import com.unihack8.backend.users.domain.dto.ProfileSearchResult;
import com.unihack8.backend.users.domain.dto.UsernameAvailabilityResponse;
import com.unihack8.backend.users.domain.entity.Profile;
import com.unihack8.backend.users.mapper.ProfileMapper;
import com.unihack8.backend.users.repository.AttendedEventRepository;
import com.unihack8.backend.users.repository.ProfileRepository;
import com.unihack8.backend.users.service.UserService;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;
import java.util.regex.Pattern;

@Service
public class UserServiceImpl implements UserService {
    // Same rule as the profiles table check in the Supabase migration.
    private static final Pattern USERNAME = Pattern.compile("[A-Za-z0-9_]{3,20}");
    private static final int SEARCH_LIMIT = 20;

    private final ProfileRepository profiles;
    private final AttendedEventRepository attendedEvents;
    private final ProfileMapper mapper;

    // Combines profile storage, attended events, and response mapping.
    public UserServiceImpl(ProfileRepository profiles, AttendedEventRepository attendedEvents, ProfileMapper mapper) {
        this.profiles = profiles;
        this.attendedEvents = attendedEvents;
        this.mapper = mapper;
    }

    // Returns a profile and only its confirmed attended events.
    @Override
    @Transactional(readOnly = true)
    public ProfileResponse getProfile(UUID userId) {
        Profile profile = profiles.findById(userId).orElseThrow(() -> ApiException.notFound("User"));
        return mapper.toResponse(profile, attendedEvents.findAttendedByUserId(userId));
    }

    // Changes the username and handles a concurrent uniqueness conflict.
    @Override
    @Transactional
    public ProfileResponse updateUsername(UUID userId, String username) {
        requireValidUsername(username);
        Profile profile = profiles.findById(userId).orElseThrow(() -> ApiException.notFound("User"));
        if (profiles.existsByUsernameIgnoreCaseAndIdNot(username, userId)) {
            throw new ApiException(ErrorCode.USERNAME_TAKEN);
        }
        profile.changeUsername(username);
        try {
            profiles.saveAndFlush(profile);
        } catch (DataIntegrityViolationException exception) {
            throw new ApiException(ErrorCode.USERNAME_TAKEN);
        }
        return mapper.toResponse(profile, attendedEvents.findAttendedByUserId(userId));
    }

    // Finds a stable, capped list of usernames matching the prefix.
    @Override
    @Transactional(readOnly = true)
    public List<ProfileSearchResult> search(String query) {
        String prefix = query == null ? "" : query.trim();
        if (prefix.isEmpty()) {
            throw new ApiException(ErrorCode.VALIDATION_FAILED, "q must contain at least one character.");
        }
        return profiles.findByUsernameStartingWithIgnoreCase(prefix,
                        PageRequest.of(0, SEARCH_LIMIT, Sort.by(Sort.Direction.ASC, "username")))
                .stream().map(mapper::toSearchResult).toList();
    }

    // Reports whether nobody owns the username yet (case-insensitive).
    @Override
    @Transactional(readOnly = true)
    public UsernameAvailabilityResponse checkUsername(String username) {
        requireValidUsername(username);
        return new UsernameAvailabilityResponse(username, !profiles.existsByUsernameIgnoreCase(username));
    }

    // Throws 400 INVALID_USERNAME unless the name is 3-20 letters, digits or underscores.
    private void requireValidUsername(String username) {
        if (username == null || !USERNAME.matcher(username).matches()) {
            throw new ApiException(ErrorCode.INVALID_USERNAME);
        }
    }
}
