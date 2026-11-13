package com.unihack8.backend.eventimport.service.impl;

import com.unihack8.backend.common.geo.GeoPoint;
import com.unihack8.backend.eventimport.client.LiveTicketsClient;
import com.unihack8.backend.eventimport.client.dto.LiveTicketsEvent;
import com.unihack8.backend.eventimport.domain.dto.ImportedEvent;
import com.unihack8.backend.eventimport.mapper.LiveTicketsEventMapper;
import com.unihack8.backend.eventimport.mapper.impl.LiveTicketsEventMapperImpl;
import com.unihack8.backend.eventimport.repository.ExternalEventRepository;
import com.unihack8.backend.eventimport.service.EventImportService;
import com.unihack8.backend.eventimport.service.VenueGeocoder;
import java.time.Clock;
import java.time.Instant;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * One import run: download (no transaction held), map, locate venues that still need coordinates
 * (Nominatim is slow: 1 request/second), then write everything in one transaction.
 */
@Service
public class EventImportServiceImpl implements EventImportService {

    private static final Logger log = LoggerFactory.getLogger(EventImportServiceImpl.class);

    private final LiveTicketsClient client;
    private final LiveTicketsEventMapper mapper;
    private final VenueGeocoder geocoder;
    private final ExternalEventRepository events;
    private final TransactionTemplate transaction;
    private final Clock clock;

    // Wires the LiveTickets client, mapper, geocoder, repository, transactions and the shared clock.
    public EventImportServiceImpl(LiveTicketsClient client, LiveTicketsEventMapper mapper, VenueGeocoder geocoder,
                                  ExternalEventRepository events, PlatformTransactionManager transactionManager,
                                  Clock clock) {
        this.client = client;
        this.mapper = mapper;
        this.geocoder = geocoder;
        this.events = events;
        this.transaction = new TransactionTemplate(transactionManager);
        this.clock = clock;
    }

    // Runs the whole import and logs a one-line summary.
    @Override
    public Result importEvents() {
        List<LiveTicketsEvent> fetched = client.fetchUpcomingEvents();

        // Events in our city, one per external id (first occurrence wins).
        Map<String, ImportedEvent> incoming = new LinkedHashMap<>();
        for (LiveTicketsEvent event : fetched) {
            mapper.toImportedEvent(event).ifPresent(e -> incoming.putIfAbsent(e.externalId(), e));
        }
        if (incoming.isEmpty()) {
            // Nothing usable came back: keep what is stored rather than deleting it.
            Result result = new Result(fetched.size(), 0, 0, 0, 0, 0, 0);
            log.info("Events import: {} (nothing for the city; existing events kept)", result);
            return result;
        }

        // Locate only events that are new or still have no coordinates (outside any transaction).
        Map<String, Boolean> existing = events.findExisting(incoming.keySet());
        Map<String, GeoPoint> newLocations = new HashMap<>();
        for (ImportedEvent event : incoming.values()) {
            if (!Boolean.TRUE.equals(existing.get(event.externalId()))) {
                geocoder.locate(event.venueName()).ifPresent(point -> newLocations.put(event.externalId(), point));
            }
        }

        Instant now = Instant.now(clock);
        Result result = transaction.execute(status -> {
            int inserted = 0;
            int updated = 0;
            int located = 0;
            for (ImportedEvent event : incoming.values()) {
                GeoPoint location = newLocations.get(event.externalId());
                boolean hadCoordinates = Boolean.TRUE.equals(existing.get(event.externalId()));
                if (existing.containsKey(event.externalId())) {
                    events.update(event, location);
                    updated++;
                } else {
                    events.insert(event, location);
                    inserted++;
                }
                if (hadCoordinates || location != null) {
                    located++;
                }
            }
            int removed = events.deleteUpcomingNotIn(
                    LiveTicketsEventMapperImpl.EXTERNAL_ID_PREFIX, incoming.keySet(), now);
            return new Result(fetched.size(), incoming.size(), inserted, updated, located,
                    incoming.size() - located, removed);
        });
        log.info("Events import: {}", result);
        return result;
    }
}
