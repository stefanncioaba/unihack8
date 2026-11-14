package com.unihack8.backend.users.mapper;

import com.unihack8.backend.users.domain.dto.AttendedEventResponse;
import com.unihack8.backend.users.domain.dto.ProfileResponse;
import com.unihack8.backend.users.domain.dto.ProfileSearchResult;
import com.unihack8.backend.users.domain.entity.Profile;

import java.util.List;

public interface ProfileMapper {
    // Builds the full profile shown on profile pages.
    ProfileResponse toResponse(Profile profile, List<AttendedEventResponse> attendedEvents,
                               List<AttendedEventResponse> organizedEvents);

    // Builds the compact result shown in username search.
    ProfileSearchResult toSearchResult(Profile profile);
}
