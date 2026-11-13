package com.unihack8.backend.events.mapper;

import com.unihack8.backend.events.domain.dto.EventDetail;
import com.unihack8.backend.events.domain.dto.EventSummary;
import com.unihack8.backend.events.domain.dto.UserSummary;
import com.unihack8.backend.events.domain.entity.Event;
import com.unihack8.backend.users.domain.entity.Profile;

/** Maps database domain objects to the public API contract. */
public interface EventMapper {
    // Returns a compact event for lists and maps.
    EventSummary summary(Event event, int participantCount);

    // Returns event detail with organizer and caller state.
    EventDetail detail(Event event, int participantCount, UserSummary organizer, String myStatus);

    // Returns a compact public profile.
    UserSummary user(Profile profile);
}
