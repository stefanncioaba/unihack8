package com.unihack8.backend.places.domain;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.Arrays;
import java.util.Map;
import org.junit.jupiter.api.Test;

/** The 10 categories and their OpenStreetMap tags (PLAN 8.1). */
class PlaceCategoryTest {

    // The API names match docs/API.md exactly.
    @Test
    void apiNamesMatchTheContract() {
        assertThat(Arrays.stream(PlaceCategory.values()).map(PlaceCategory::apiName))
                .containsExactly("restaurant", "cafe", "bar", "fast_food", "club", "pharmacy", "atm",
                        "supermarket", "park", "attraction");
    }

    // Typical tags map to the expected category.
    @Test
    void mapsOsmTags() {
        assertThat(PlaceCategory.fromOsmTags(Map.of("amenity", "pub"))).contains(PlaceCategory.BAR);
        assertThat(PlaceCategory.fromOsmTags(Map.of("amenity", "nightclub"))).contains(PlaceCategory.CLUB);
        assertThat(PlaceCategory.fromOsmTags(Map.of("shop", "supermarket"))).contains(PlaceCategory.SUPERMARKET);
        assertThat(PlaceCategory.fromOsmTags(Map.of("leisure", "park"))).contains(PlaceCategory.PARK);
        assertThat(PlaceCategory.fromOsmTags(Map.of("tourism", "museum"))).contains(PlaceCategory.ATTRACTION);
        assertThat(PlaceCategory.fromOsmTags(Map.of("amenity", "bench"))).isEmpty();
        assertThat(PlaceCategory.fromOsmTags(null)).isEmpty();
    }

    // A church that is also a tourist attraction counts as an attraction.
    @Test
    void unmatchedAmenityFallsThroughToTourism() {
        assertThat(PlaceCategory.fromOsmTags(Map.of("amenity", "place_of_worship", "tourism", "attraction")))
                .contains(PlaceCategory.ATTRACTION);
    }

    // API names are looked up ignoring case and spaces.
    @Test
    void findsByApiName() {
        assertThat(PlaceCategory.fromApiName(" Fast_Food ")).contains(PlaceCategory.FAST_FOOD);
        assertThat(PlaceCategory.fromApiName("casino")).isEmpty();
        assertThat(PlaceCategory.fromApiName(null)).isEmpty();
    }
}
