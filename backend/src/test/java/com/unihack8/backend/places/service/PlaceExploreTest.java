package com.unihack8.backend.places.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.unihack8.backend.common.geo.GeoPoint;
import com.unihack8.backend.places.domain.PlaceCategory;
import com.unihack8.backend.places.domain.PriceItemType;
import com.unihack8.backend.places.domain.dto.PlaceExploreCriteria;
import com.unihack8.backend.places.domain.dto.PlaceInsightDto;
import com.unihack8.backend.places.domain.dto.PriceDto;
import com.unihack8.backend.places.domain.entity.Place;
import com.unihack8.backend.places.domain.entity.PlacePrice;
import com.unihack8.backend.places.repository.PlacePriceRepository;
import com.unihack8.backend.places.repository.PlaceRepository;
import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

/** PlaceService.explore on the H2 test database: keyword over tags, stored prices, price sorting (PLAN 11.2/11.3). */
@SpringBootTest
class PlaceExploreTest {

    private static final GeoPoint CENTRE = new GeoPoint(45.7537, 21.2257);

    @Autowired
    private PlaceService service;

    @Autowired
    private PlaceRepository places;

    @Autowired
    private PlacePriceRepository prices;

    // Three cafés (one a chain branch named differently), one pizzeria, one far away.
    @BeforeEach
    void seed() {
        // Other test classes share this H2 database: start from empty tables.
        prices.deleteAll();
        places.deleteAll();
        places.save(place("explore/1", "Starbucks", PlaceCategory.CAFE, 45.7540, 21.2260, Map.of("cuisine", "coffee_shop")));
        places.save(place("explore/2", "5 to go Libertatii", PlaceCategory.CAFE, 45.7550, 21.2270,
                Map.of("brand", "5 to go", "cuisine", "coffee_shop")));
        places.save(place("explore/3", "Tiny Cafe", PlaceCategory.CAFE, 45.7538, 21.2258, Map.of()));
        places.save(place("explore/4", "Napoli", PlaceCategory.RESTAURANT, 45.7545, 21.2265, Map.of("cuisine", "pizza;italian")));
        places.save(place("explore/5", "Far Coffee", PlaceCategory.CAFE, 45.8000, 21.3000, Map.of()));
        prices.save(price("Starbucks", "Caffè Latte", "COFFEE", "21.90"));
        prices.save(price("starbucks", "Americano", "COFFEE", "8.90"));
        prices.save(price("5 to go", "Espresso", "COFFEE", "5.00"));
        prices.save(price("Napoli", "Margherita", "PIZZA", "35.00"));
        prices.save(price("Napoli", "Espresso", "COFFEE", "7.00"));
    }

    // Cleans both tables between tests.
    @AfterEach
    void clean() {
        prices.deleteAll();
        places.deleteAll();
    }

    // Cheapest first; chain prices found through the brand tag; places without a price last; far ones out.
    @Test
    void cheapestCoffee() {
        List<PlaceInsightDto> found = service.explore(new PlaceExploreCriteria(Set.of(PlaceCategory.CAFE), null,
                CENTRE, 1500, PriceItemType.COFFEE, false, true, 10));

        assertThat(found).extracting(p -> p.place().name()).containsExactly("5 to go Libertatii", "Starbucks", "Tiny Cafe");
        assertThat(found.get(1).prices()).extracting(PriceDto::priceLei)
                .containsExactly(new BigDecimal("8.90"), new BigDecimal("21.90"));
        assertThat(found.get(2).prices()).isEmpty();
        assertThat(found.getFirst().distanceMeters()).isPositive();
    }

    // Keyword matches the cuisine tag; only prices of the asked type are returned.
    @Test
    void keywordAndPriceType() {
        List<PlaceInsightDto> found = service.explore(new PlaceExploreCriteria(Set.of(), "pizza", CENTRE, 1500,
                PriceItemType.PIZZA, true, false, 10));
        assertThat(found).extracting(p -> p.place().name()).containsExactly("Napoli");
        assertThat(found.getFirst().prices()).extracting(PriceDto::item).containsExactly("Margherita");
    }

    // Distance order by default, limit applied, onlyWithPrices drops unpriced places.
    @Test
    void distanceOrderAndLimit() {
        List<PlaceInsightDto> closest = service.explore(new PlaceExploreCriteria(Set.of(PlaceCategory.CAFE), null,
                CENTRE, 1500, null, false, false, 2));
        assertThat(closest).extracting(p -> p.place().name()).containsExactly("Tiny Cafe", "Starbucks");

        List<PlaceInsightDto> priced = service.explore(new PlaceExploreCriteria(Set.of(PlaceCategory.CAFE), null,
                CENTRE, 1500, null, true, false, 10));
        assertThat(priced).extracting(p -> p.place().name()).doesNotContain("Tiny Cafe");
    }

    // A place row as the import would save it.
    private static Place place(String osmId, String name, PlaceCategory category, double lat, double lon,
                               Map<String, String> tags) {
        Place place = new Place(osmId);
        place.update(name, category, lat, lon, null, null, tags);
        return place;
    }

    // A price row.
    private static PlacePrice price(String placeName, String item, String type, String lei) {
        return new PlacePrice(UUID.randomUUID(), placeName, item, type, new BigDecimal(lei), null,
                "delivery_app", "https://example.ro", "2026-11", null);
    }
}
