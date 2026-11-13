package com.unihack8.backend.eventimport.service.impl;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.unihack8.backend.common.geo.GeoPoint;
import com.unihack8.backend.eventimport.client.LiveTicketsClient;
import com.unihack8.backend.eventimport.client.dto.LiveTicketsEvent;
import com.unihack8.backend.eventimport.config.EventImportProperties;
import com.unihack8.backend.eventimport.support.LiveTicketsFixtures;
import com.unihack8.backend.eventimport.mapper.impl.LiveTicketsEventMapperImpl;
import com.unihack8.backend.eventimport.repository.impl.ExternalEventRepositoryImpl;
import com.unihack8.backend.eventimport.service.EventImportService;
import com.unihack8.backend.eventimport.service.VenueGeocoder;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.jdbc.datasource.DriverManagerDataSource;

/**
 * Whole import run (PLAN 7.4, 7.5) against its own in-memory H2 database with a copy of the events
 * table, a fake LiveTickets and a fake geocoder. Never touches the network or Supabase.
 */
class EventImportServiceImplTest {

    // Before every saved fixture event (13 Nov 2026), so they all count as upcoming.
    private static final Instant NOW = Instant.parse("2026-11-01T10:00:00Z");
    private static final GeoPoint FRATELLI = new GeoPoint(45.7489, 21.2087);

    private JdbcTemplate jdbc;
    private LiveTicketsClient client;
    private VenueGeocoder geocoder;
    private EventImportService service;

    // Fresh database, events table and service for each test.
    @BeforeEach
    void setUp() {
        DriverManagerDataSource dataSource = new DriverManagerDataSource(
                "jdbc:h2:mem:eventimport-" + UUID.randomUUID() + ";MODE=PostgreSQL;DATABASE_TO_LOWER=TRUE;DB_CLOSE_DELAY=-1",
                "sa", "");
        jdbc = new JdbcTemplate(dataSource);
        // Same columns and key rules as supabase/migrations/20261113000002_events.sql.
        jdbc.execute("""
                CREATE TABLE events (
                    id UUID PRIMARY KEY, source VARCHAR(10) NOT NULL, external_id VARCHAR(200) UNIQUE,
                    title VARCHAR(500) NOT NULL, description VARCHAR(5000), category VARCHAR(20),
                    venue_name VARCHAR(500), address VARCHAR(500), lat DOUBLE PRECISION, lon DOUBLE PRECISION,
                    starts_at TIMESTAMP WITH TIME ZONE NOT NULL, ends_at TIMESTAMP WITH TIME ZONE,
                    capacity INTEGER, organizer_id UUID, image_url VARCHAR(1000),
                    price_min NUMERIC(10, 2), price_max NUMERIC(10, 2), external_url VARCHAR(1000),
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                    CHECK ((lat IS NULL) = (lon IS NULL)),
                    CHECK (ends_at IS NULL OR ends_at > starts_at))
                """);
        client = mock(LiveTicketsClient.class);
        geocoder = mock(VenueGeocoder.class);
        when(geocoder.locate(anyString())).thenReturn(Optional.empty());
        when(geocoder.locate("Fratelli Lounge & Club Timisoara")).thenReturn(Optional.of(FRATELLI));
        service = new EventImportServiceImpl(client, new LiveTicketsEventMapperImpl(EventImportProperties.defaults()),
                geocoder, new ExternalEventRepositoryImpl(jdbc), new DataSourceTransactionManager(dataSource),
                Clock.fixed(NOW, ZoneOffset.UTC));
    }

    // Number of rows in events.
    private int count() {
        return jdbc.queryForObject("SELECT COUNT(*) FROM events", Integer.class);
    }

    // First run: the 8 Timișoara events are stored; the two Fratelli parties get coordinates.
    @Test
    void firstRunInsertsCityEvents() {
        when(client.fetchUpcomingEvents()).thenReturn(LiveTicketsFixtures.sample());

        EventImportService.Result result = service.importEvents();

        assertThat(result).isEqualTo(new EventImportService.Result(11, 8, 8, 0, 2, 6, 0));
        assertThat(count()).isEqualTo(8);
        Map<String, Object> albwho = jdbc.queryForMap("SELECT * FROM events WHERE title = 'ALBWHO at Fratelli Timisoara'");
        assertThat(albwho.get("source")).isEqualTo("EXTERNAL");
        assertThat((String) albwho.get("external_id")).startsWith("livetickets:");
        assertThat(albwho.get("category")).isEqualTo("PARTY");
        assertThat(albwho.get("lat")).isEqualTo(FRATELLI.lat());
        assertThat(albwho.get("lon")).isEqualTo(FRATELLI.lon());
        assertThat((String) albwho.get("image_url")).startsWith("https://livetickets-cdn.azureedge.net/itemimages/");
        assertThat((String) albwho.get("external_url")).isEqualTo("https://www.livetickets.ro/bilete/albwho-at-fratelli-timisoara");
        assertThat((String) albwho.get("description")).isNotBlank().doesNotContain("<br");
        assertThat((BigDecimal) albwho.get("price_min")).isEqualByComparingTo("40");
        assertThat(albwho.get("organizer_id")).isNull();
        assertThat(albwho.get("capacity")).isNull();
        Instant startsAt = jdbc.queryForObject(
                "SELECT starts_at FROM events WHERE title = 'ALBWHO at Fratelli Timisoara'", java.time.OffsetDateTime.class)
                .toInstant();
        assertThat(startsAt).isEqualTo(Instant.parse("2026-11-13T21:00:00Z"));
    }

    // Second run: no duplicates, details refreshed, located events are not geocoded again.
    @Test
    void secondRunUpdatesWithoutDuplicates() {
        when(client.fetchUpcomingEvents()).thenReturn(LiveTicketsFixtures.sample());
        service.importEvents();

        List<LiveTicketsEvent> renamed = new ArrayList<>(LiveTicketsFixtures.sample());
        LiveTicketsEvent first = renamed.get(0);
        renamed.set(0, new LiveTicketsEvent(first.eventId(), first.url(), "ALBWHO (new lineup)", first.description(),
                first.location(), first.city(), first.startDate(), first.endDate(), first.priceMin(), first.priceMax(),
                first.image(), first.imageToken()));
        when(client.fetchUpcomingEvents()).thenReturn(renamed);
        org.mockito.Mockito.clearInvocations(geocoder);

        EventImportService.Result result = service.importEvents();

        assertThat(result.inserted()).isZero();
        assertThat(result.updated()).isEqualTo(8);
        assertThat(result.located()).isEqualTo(2);
        assertThat(count()).isEqualTo(8);
        assertThat(jdbc.queryForObject("SELECT lat FROM events WHERE title = 'ALBWHO (new lineup)'", Double.class))
                .isEqualTo(FRATELLI.lat());
        verify(geocoder, never()).locate("Fratelli Lounge & Club Timisoara");
    }

    // An event that had no coordinates gets them on a later run once its venue can be located.
    @Test
    void laterRunLocatesPreviouslyUnlocatedEvents() {
        when(client.fetchUpcomingEvents()).thenReturn(LiveTicketsFixtures.sample());
        service.importEvents();
        when(geocoder.locate("Heaven")).thenReturn(Optional.of(new GeoPoint(45.75, 21.23)));

        EventImportService.Result result = service.importEvents();

        assertThat(result.located()).isEqualTo(3);
        assertThat(jdbc.queryForObject("SELECT lat FROM events WHERE venue_name = 'Heaven'", Double.class)).isEqualTo(45.75);
    }

    // An upcoming imported event LiveTickets no longer lists is removed; a user event is never touched.
    @Test
    void removesCancelledUpcomingEventsOnly() {
        when(client.fetchUpcomingEvents()).thenReturn(LiveTicketsFixtures.sample());
        service.importEvents();
        jdbc.update("INSERT INTO events (id, source, title, starts_at) VALUES (?, 'USER', 'Board games', ?)",
                UUID.randomUUID(), NOW.plusSeconds(86_400).atOffset(ZoneOffset.UTC));

        List<LiveTicketsEvent> fewer = new ArrayList<>(LiveTicketsFixtures.sample());
        fewer.remove(0);
        when(client.fetchUpcomingEvents()).thenReturn(fewer);
        EventImportService.Result result = service.importEvents();

        assertThat(result.removed()).isEqualTo(1);
        assertThat(count()).isEqualTo(8);  // 7 imported + the user event
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM events WHERE source = 'USER'", Integer.class)).isEqualTo(1);
    }

    // An empty or all-other-cities answer keeps every stored event.
    @Test
    void emptyAnswerRemovesNothing() {
        when(client.fetchUpcomingEvents()).thenReturn(LiveTicketsFixtures.sample());
        service.importEvents();

        when(client.fetchUpcomingEvents()).thenReturn(List.of());
        assertThat(service.importEvents()).isEqualTo(new EventImportService.Result(0, 0, 0, 0, 0, 0, 0));
        when(client.fetchUpcomingEvents()).thenReturn(LiveTicketsFixtures.sample().subList(8, 11));
        assertThat(service.importEvents().removed()).isZero();

        assertThat(count()).isEqualTo(8);
    }
}
