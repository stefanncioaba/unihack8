package com.unihack8.backend.users.repository;

import com.unihack8.backend.users.domain.dto.AttendedEventResponse;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public interface AttendedEventRepository {
    // Lists only events with a confirmed attendance status.
    List<AttendedEventResponse> findAttendedByUserId(UUID userId);

    // Lists user events this user organised that are over at the given time, newest first.
    List<AttendedEventResponse> findPastOrganizedByUserId(UUID userId, Instant now);
}
