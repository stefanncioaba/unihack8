package com.unihack8.backend.users.mapper.impl;

import com.unihack8.backend.users.domain.dto.AttendedEventResponse;
import com.unihack8.backend.users.domain.dto.ProfileResponse;
import com.unihack8.backend.users.domain.dto.ProfileSearchResult;
import com.unihack8.backend.users.domain.entity.Profile;
import com.unihack8.backend.users.mapper.ProfileMapper;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
public class ProfileMapperImpl implements ProfileMapper {

    // Maps stored profile fields, attendance and past organised events into an API response.
    @Override
    public ProfileResponse toResponse(Profile profile, List<AttendedEventResponse> attendedEvents,
                                      List<AttendedEventResponse> organizedEvents) {
        return new ProfileResponse(profile.getId(), profile.getUsername(), profile.getReliabilityScore(),
                profile.getCreatedAt(), attendedEvents, organizedEvents);
    }

    // Maps the public fields needed for username search.
    @Override
    public ProfileSearchResult toSearchResult(Profile profile) {
        return new ProfileSearchResult(profile.getId(), profile.getUsername(), profile.getReliabilityScore());
    }
}
