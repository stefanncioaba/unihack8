package com.unihack8.backend.places.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.unihack8.backend.places.client.OverpassClient;
import com.unihack8.backend.places.client.dto.OverpassElement;
import com.unihack8.backend.places.client.dto.OverpassResponse;
import com.unihack8.backend.places.domain.PlaceCategory;
import com.unihack8.backend.places.domain.entity.Place;
import com.unihack8.backend.places.mapper.impl.OsmElementMapperImpl;
import com.unihack8.backend.places.repository.PlaceRepository;
import com.unihack8.backend.places.service.impl.PlaceImportServiceImpl;
import com.unihack8.backend.places.support.OverpassFixtures;
import jakarta.persistence.EntityManager;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jdbc.test.autoconfigure.AutoConfigureTestDatabase;
import org.springframework.transaction.PlatformTransactionManager;

/** The import against the in-memory H2 database, with a fake Overpass client returning the fixture. */
@DataJpaTest
// Use the H2 database from src/test/resources/application.properties (PostgreSQL mode), not a fresh default one.
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
class PlaceImportServiceImplTest {

    @Autowired
    private PlaceRepository placeRepository;

    @Autowired
    private PlatformTransactionManager transactionManager;

    @Autowired
    private EntityManager entityManager;

    private final OverpassClient overpassClient = mock(OverpassClient.class);
    private PlaceImportService service;
    private List<OverpassElement> fixture;

    // Builds the service by hand with the real repository and mapper and the fake client. The test
    // database is shared with other test classes, so start from an empty places table.
    @BeforeEach
    void setUp() {
        placeRepository.deleteAll();
        service = new PlaceImportServiceImpl(overpassClient, new OsmElementMapperImpl(), placeRepository,
                transactionManager);
        fixture = OverpassFixtures.timisoaraSample().elements();
    }

    // Makes the fake Overpass client answer with these elements.
    private void overpassReturns(List<OverpassElement> elements) {
        when(overpassClient.fetchPlaces()).thenReturn(new OverpassResponse(elements));
    }

    // Writes pending changes and forgets cached rows, so the next read hits the database.
    private void flushAndClear() {
        entityManager.flush();
        entityManager.clear();
    }

    // First run stores the 8 valid fixture places and skips the unnamed park.
    @Test
    void firstRunInserts() {
        overpassReturns(fixture);

        PlaceImportService.Result result = service.importPlaces();
        flushAndClear();

        assertThat(result).isEqualTo(new PlaceImportService.Result(9, 8, 0, 1, 0));
        assertThat(placeRepository.count()).isEqualTo(8);
        Place restaurant = placeRepository.findByOsmIdIn(List.of("node/380526548")).getFirst();
        assertThat(restaurant.getName()).isEqualTo("Restaurant Tinecz");
        assertThat(restaurant.getCategory()).isEqualTo(PlaceCategory.RESTAURANT);
        assertThat(restaurant.getAddress()).isEqualTo("Calea Aradului 51");
        assertThat(restaurant.getOpeningHours()).isEqualTo("Mo-Su 11:00-23:00");
        assertThat(restaurant.getTags()).containsEntry("cuisine", "regional");
    }

    // Running again updates the same rows instead of creating duplicates, and picks up changes.
    @Test
    void secondRunUpdatesWithoutDuplicates() {
        overpassReturns(fixture);
        service.importPlaces();
        flushAndClear();
        List<String> idsBefore = placeRepository.findAll().stream().map(p -> p.getId().toString()).sorted().toList();

        List<OverpassElement> renamed = new ArrayList<>(fixture);
        OverpassElement cafe = fixture.get(1);
        renamed.set(1, new OverpassElement(cafe.type(), cafe.id(), cafe.lat(), cafe.lon(), null,
                Map.of("amenity", "cafe", "name", "Barista Centru")));
        overpassReturns(renamed);
        PlaceImportService.Result second = service.importPlaces();
        flushAndClear();

        assertThat(second).isEqualTo(new PlaceImportService.Result(9, 0, 8, 1, 0));
        assertThat(placeRepository.count()).isEqualTo(8);
        assertThat(placeRepository.findAll().stream().map(p -> p.getId().toString()).sorted().toList())
                .isEqualTo(idsBefore);
        assertThat(placeRepository.findByOsmIdIn(List.of("node/1239892209")).getFirst().getName())
                .isEqualTo("Barista Centru");
    }

    // A place that is no longer returned by Overpass is removed.
    @Test
    void removesVanishedPlaces() {
        overpassReturns(fixture);
        service.importPlaces();
        flushAndClear();

        List<OverpassElement> withoutClub = fixture.stream().filter(e -> e.id() != 5140855129L).toList();
        overpassReturns(withoutClub);
        PlaceImportService.Result result = service.importPlaces();
        flushAndClear();

        assertThat(result.removed()).isEqualTo(1);
        assertThat(placeRepository.count()).isEqualTo(7);
        assertThat(placeRepository.findByOsmIdIn(List.of("node/5140855129"))).isEmpty();
    }

    // An empty answer (or one with nothing usable) never wipes the table.
    @Test
    void emptyFetchRemovesNothing() {
        overpassReturns(fixture);
        service.importPlaces();
        flushAndClear();

        overpassReturns(List.of());
        PlaceImportService.Result empty = service.importPlaces();
        OverpassElement unnamedPark = fixture.get(4);
        overpassReturns(List.of(unnamedPark));
        PlaceImportService.Result onlyInvalid = service.importPlaces();
        flushAndClear();

        assertThat(empty).isEqualTo(new PlaceImportService.Result(0, 0, 0, 0, 0));
        assertThat(onlyInvalid).isEqualTo(new PlaceImportService.Result(1, 0, 0, 1, 0));
        assertThat(placeRepository.count()).isEqualTo(8);
    }

    // An element repeated in the answer is stored once and counted as skipped.
    @Test
    void duplicateElementsStoredOnce() {
        List<OverpassElement> doubled = new ArrayList<>(fixture);
        doubled.add(fixture.get(0));
        overpassReturns(doubled);

        PlaceImportService.Result result = service.importPlaces();
        flushAndClear();

        assertThat(result).isEqualTo(new PlaceImportService.Result(10, 8, 0, 2, 0));
        assertThat(placeRepository.count()).isEqualTo(8);
    }
}
