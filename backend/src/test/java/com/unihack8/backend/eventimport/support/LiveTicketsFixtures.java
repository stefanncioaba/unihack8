package com.unihack8.backend.eventimport.support;

import com.unihack8.backend.eventimport.client.dto.LiveTicketsEvent;
import com.unihack8.backend.eventimport.client.impl.LiveTicketsClientImpl;
import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.util.List;

/**
 * The saved LiveTickets response (src/test/resources/livetickets/event-search-sample.json): 8
 * Timișoara events, 2 from other cities and 1 without a city, from the real feed on 2026-11-13.
 */
public final class LiveTicketsFixtures {

    // Utility class.
    private LiveTicketsFixtures() {
    }

    // The 11 saved events, parsed exactly like the real client does.
    public static List<LiveTicketsEvent> sample() {
        try (InputStream in = LiveTicketsFixtures.class.getResourceAsStream("/livetickets/event-search-sample.json")) {
            return LiveTicketsClientImpl.parse(new String(in.readAllBytes(), StandardCharsets.UTF_8)).items();
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }
}
