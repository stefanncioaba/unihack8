package com.unihack8.backend.events.mapper;

import com.unihack8.backend.events.domain.entity.Event;
import com.unihack8.backend.events.mapper.impl.EventMapperImpl;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/** Contract mapping for imported events and capacity. */
class EventMapperImplTest {
    private final EventMapperImpl mapper = new EventMapperImpl();

    // Imported event responses never expose a capacity, even if legacy data has one.
    @Test
    void externalEventHasNoCapacityOrSpots() {
        Event event = new Event(UUID.randomUUID(), "EXTERNAL", "source:1", "Concert", null,
                null, "Venue", null, 45.7, 21.2, Instant.parse("2030-11-14T17:00:00Z"),
                null, 10, null, null, null, null, "https://example.com", Instant.parse("2026-11-13T10:00:00Z"));
        var summary = mapper.summary(event, 2);
        var detail = mapper.detail(event, 2, null, null);
        assertEquals("OTHER", summary.category());
        assertNull(summary.capacity());
        assertNull(summary.spotsLeft());
        assertNull(detail.capacity());
        assertNull(detail.spotsLeft());
    }
}
