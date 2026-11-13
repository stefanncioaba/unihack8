package com.unihack8.backend.users.service.impl;

import com.unihack8.backend.users.domain.dto.ProfileResponse;
import com.unihack8.backend.users.domain.dto.ProfileSearchResult;
import com.unihack8.backend.users.domain.entity.Profile;
import com.unihack8.backend.users.mapper.ProfileMapper;
import com.unihack8.backend.users.repository.AttendedEventRepository;
import com.unihack8.backend.users.repository.ProfileRepository;
import com.unihack8.backend.users.service.InvalidSearchException;
import com.unihack8.backend.users.service.UserNotFoundException;
import com.unihack8.backend.users.service.UserService;
import com.unihack8.backend.users.service.UsernameTakenException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
public class UserServiceImpl implements UserService {
    private final ProfileRepository profiles;
    private final AttendedEventRepository attendedEvents;
    private final ProfileMapper mapper;

    // Combines profile storage, attended events, and response mapping.
    public UserServiceImpl(ProfileRepository profiles, AttendedEventRepository attendedEvents, ProfileMapper mapper) {
        this.profiles = profiles;
        this.attendedEvents = attendedEvents;
        this.mapper = mapper;
    }

    // Returns the authenticated user's profile.
    @Override
    @Transactional(readOnly = true)
    public ProfileResponse getOwnProfile(UUID userId) {
        return getPublicProfile(userId);
    }

    // Changes the username and handles a concurrent uniqueness conflict.
    @Override
    @Transactional
    public ProfileResponse updateUsername(UUID userId, String username) {
        Profile profile = profiles.findById(userId).orElseThrow(UserNotFoundException::new);
        if (profiles.existsByUsernameIgnoreCaseAndIdNot(username, userId)) {
            throw new UsernameTakenException();
        }
        profile.changeUsername(username);
        try {
            profiles.saveAndFlush(profile);
        } catch (DataIntegrityViolationException exception) {
            throw new UsernameTakenException();
        }
        return mapper.toResponse(profile, attendedEvents.findAttendedByUserId(userId));
    }

    // Finds a stable, capped list of usernames matching the prefix.
    @Override
    @Transactional(readOnly = true)
    public List<ProfileSearchResult> search(String query) {
        if (query == null || query.isBlank()) {
            throw new InvalidSearchException();
        }
        return profiles.findByUsernameStartingWithIgnoreCase(query,
                        PageRequest.of(0, 20, Sort.by(Sort.Direction.ASC, "username")))
                .stream().map(mapper::toSearchResult).toList();
    }

    // Returns a public profile and only confirmed attended events.
    @Override
    @Transactional(readOnly = true)
    public ProfileResponse getPublicProfile(UUID userId) {
        Profile profile = profiles.findById(userId).orElseThrow(UserNotFoundException::new);
        return mapper.toResponse(profile, attendedEvents.findAttendedByUserId(userId));
    }
}
