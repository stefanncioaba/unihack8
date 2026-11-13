package com.unihack8.backend.events.mapper.impl;

import com.unihack8.backend.events.domain.dto.EventDetail;
import com.unihack8.backend.events.domain.dto.EventSummary;
import com.unihack8.backend.events.domain.dto.UserSummary;
import com.unihack8.backend.events.domain.entity.Event;
import com.unihack8.backend.events.mapper.EventMapper;
import com.unihack8.backend.users.domain.entity.Profile;
import org.springframework.stereotype.Component;

/** Hand-written event and participant response mapping. */
@Component
public class EventMapperImpl implements EventMapper {
    // Uses OTHER for imported events without a classification.
    @Override
    public EventSummary summary(Event e, int count) {
        Integer capacity = "EXTERNAL".equals(e.source()) ? null : e.capacity();
        return new EventSummary(e.id(), e.source(), e.title(), category(e), e.venueName(),
                e.lat(), e.lon(), e.startsAt(), e.endsAt(), e.imageUrl(), e.priceMin(),
                e.priceMax(), capacity, spots(capacity, count));
    }

    // Includes the caller's status only when a valid token was supplied.
    @Override
    public EventDetail detail(Event e, int count, UserSummary organizer, String myStatus) {
        Integer capacity = "EXTERNAL".equals(e.source()) ? null : e.capacity();
        return new EventDetail(e.id(), e.source(), e.title(), e.description(), category(e),
                e.venueName(), e.address(), e.lat(), e.lon(), e.startsAt(), e.endsAt(),
                e.imageUrl(), e.priceMin(), e.priceMax(), e.externalUrl(), capacity,
                spots(capacity, count), count, organizer, myStatus);
    }

    // Exposes only the profile fields used on event pages.
    @Override
    public UserSummary user(Profile profile) {
        return new UserSummary(profile.getId(), profile.getUsername(), profile.getReliabilityScore());
    }

    // Computes available capacity, or null for unlimited events.
    private Integer spots(Integer capacity, int count) {
        return capacity == null ? null : Math.max(0, capacity - count);
    }

    // Normalizes a missing imported category to OTHER.
    private String category(Event event) {
        return event.category() == null ? "OTHER" : event.category();
    }
}
