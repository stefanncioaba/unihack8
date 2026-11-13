package com.unihack8.backend.places.controller;

import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.containsInAnyOrder;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.unihack8.backend.places.domain.PlaceCategory;
import com.unihack8.backend.places.domain.entity.Place;
import com.unihack8.backend.places.repository.PlaceRepository;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;

/** GET /places and GET /places/{id} against the H2 test database (PLAN 8.3, 8.4, 8.5). */
@SpringBootTest
@AutoConfigureMockMvc
class PlaceControllerTest {

    // Piața Victoriei, the centre used for "near" searches.
    private static final String CENTRE = "45.7537,21.2257";

    @Autowired
    private MockMvc mvc;

    @Autowired
    private PlaceRepository places;

    private UUID cafeId;

    // Fresh set of four places before every test.
    @BeforeEach
    void seed() {
        places.deleteAll();
        cafeId = places.save(place("node/1", "Cafe Victoria", PlaceCategory.CAFE, 45.7540, 21.2260,
                Map.of("cuisine", "coffee_shop", "website", "https://cafe.example", "internal_note", "x"))).getId();
        places.save(place("node/2", "Pizzeria Napoli", PlaceCategory.RESTAURANT, 45.7600, 21.2300, Map.of()));
        places.save(place("way/3", "Bar Departe", PlaceCategory.BAR, 45.7800, 21.2600, Map.of()));
        places.save(place("way/4", "Parcul 100%_Verde", PlaceCategory.PARK, 45.7500, 21.2200, Map.of()));
    }

    // Builds a place row.
    private static Place place(String osmId, String name, PlaceCategory category, double lat, double lon,
                               Map<String, String> tags) {
        Place place = new Place(osmId);
        place.update(name, category, lat, lon, "Strada Test 1", "Mo-Su 10:00-22:00", tags);
        return place;
    }

    // Public: works without a token, sorted by name, paged shape.
    @Test
    void listsAllPlacesByNameWithoutToken() throws Exception {
        mvc.perform(get("/places"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[*].name",
                        contains("Bar Departe", "Cafe Victoria", "Parcul 100%_Verde", "Pizzeria Napoli")))
                .andExpect(jsonPath("$.items[0].distanceMeters").value(nullValue()))
                .andExpect(jsonPath("$.page").value(0))
                .andExpect(jsonPath("$.size").value(20))
                .andExpect(jsonPath("$.totalItems").value(4))
                .andExpect(jsonPath("$.totalPages").value(1));
    }

    // Category filter accepts repeated and comma-separated values.
    @Test
    void filtersByCategories() throws Exception {
        mvc.perform(get("/places").param("category", "cafe").param("category", "bar"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[*].name", containsInAnyOrder("Cafe Victoria", "Bar Departe")));
        mvc.perform(get("/places").param("category", "restaurant,park"))
                .andExpect(jsonPath("$.items[*].category", containsInAnyOrder("restaurant", "park")));
    }

    // Only places inside the viewport are returned.
    @Test
    void filtersByBoundingBox() throws Exception {
        // The park sits at 45.75,21.22 — just outside this box's south-west corner.
        mvc.perform(get("/places").param("bbox", "21.221,45.751,21.235,45.765"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[*].name", containsInAnyOrder("Cafe Victoria", "Pizzeria Napoli")));
    }

    // Near: closest first, distance in meters, far places outside the radius left out.
    @Test
    void nearSortsByDistanceWithinRadius() throws Exception {
        mvc.perform(get("/places").param("near", CENTRE).param("radius", "1500"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[*].name",
                        contains("Cafe Victoria", "Parcul 100%_Verde", "Pizzeria Napoli")))
                .andExpect(jsonPath("$.items[0].distanceMeters").value(41))
                .andExpect(jsonPath("$.totalItems").value(3));
    }

    // Near with the default radius (1500 m) and paging through the sorted results.
    @Test
    void nearPagesThroughSortedResults() throws Exception {
        mvc.perform(get("/places").param("near", CENTRE).param("size", "2").param("page", "1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items", hasSize(1)))
                .andExpect(jsonPath("$.items[0].name").value("Pizzeria Napoli"))
                .andExpect(jsonPath("$.totalItems").value(3))
                .andExpect(jsonPath("$.totalPages").value(2));
    }

    // Name search ignores case and treats % and _ literally.
    @Test
    void searchesByName() throws Exception {
        mvc.perform(get("/places").param("q", "NAPOLI"))
                .andExpect(jsonPath("$.items[*].name", contains("Pizzeria Napoli")));
        mvc.perform(get("/places").param("q", "100%_v"))
                .andExpect(jsonPath("$.items[*].name", contains("Parcul 100%_Verde")));
        mvc.perform(get("/places").param("q", "%"))
                .andExpect(jsonPath("$.items[*].name", contains("Parcul 100%_Verde")));
    }

    // Unknown category is a validation error that lists the valid ones.
    @Test
    void unknownCategoryIs400() throws Exception {
        mvc.perform(get("/places").param("category", "casino"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
    }

    // Malformed bbox, near and radius values are validation errors.
    @Test
    void badGeoParametersAre400() throws Exception {
        mvc.perform(get("/places").param("bbox", "21.2,45.7")).andExpect(status().isBadRequest());
        mvc.perform(get("/places").param("bbox", "21.3,45.7,21.2,45.8")).andExpect(status().isBadRequest());
        mvc.perform(get("/places").param("near", "abc,21.2")).andExpect(status().isBadRequest());
        mvc.perform(get("/places").param("near", "95,21.2")).andExpect(status().isBadRequest());
        mvc.perform(get("/places").param("radius", "500")).andExpect(status().isBadRequest());
        mvc.perform(get("/places").param("near", CENTRE).param("radius", "10001")).andExpect(status().isBadRequest());
    }

    // Page size limits: 100 normally, 500 with a bbox (map markers).
    @Test
    void pageSizeLimitDependsOnBbox() throws Exception {
        mvc.perform(get("/places").param("size", "101")).andExpect(status().isBadRequest());
        mvc.perform(get("/places").param("size", "500").param("bbox", "21.1,45.6,21.4,45.9"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.size").value(500));
    }

    // Detail: all fields plus only the public tags.
    @Test
    void returnsPlaceDetail() throws Exception {
        mvc.perform(get("/places/" + cafeId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(cafeId.toString()))
                .andExpect(jsonPath("$.osmId").value("node/1"))
                .andExpect(jsonPath("$.category").value("cafe"))
                .andExpect(jsonPath("$.address").value("Strada Test 1"))
                .andExpect(jsonPath("$.openingHours").value("Mo-Su 10:00-22:00"))
                .andExpect(jsonPath("$.tags.cuisine").value("coffee_shop"))
                .andExpect(jsonPath("$.tags.website").value("https://cafe.example"))
                .andExpect(jsonPath("$.tags.internal_note").doesNotExist());
    }

    // Unknown id is 404, a non-UUID id is 400.
    @Test
    void unknownOrInvalidIdIsRejected() throws Exception {
        mvc.perform(get("/places/" + UUID.randomUUID()))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_FOUND"));
        mvc.perform(get("/places/not-a-uuid"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
    }
}
