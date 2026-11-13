package com.unihack8.backend.places.domain;

import java.util.Arrays;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

/**
 * The 10 place categories shared with the app (PLAN 8.1, docs/API.md -> PlaceSummary), and which
 * OpenStreetMap tags put a place in each one.
 */
public enum PlaceCategory {

    RESTAURANT("restaurant", "amenity", Set.of("restaurant")),
    CAFE("cafe", "amenity", Set.of("cafe")),
    BAR("bar", "amenity", Set.of("bar", "pub", "biergarten")),
    FAST_FOOD("fast_food", "amenity", Set.of("fast_food")),
    CLUB("club", "amenity", Set.of("nightclub")),
    PHARMACY("pharmacy", "amenity", Set.of("pharmacy")),
    ATM("atm", "amenity", Set.of("atm")),
    SUPERMARKET("supermarket", "shop", Set.of("supermarket")),
    PARK("park", "leisure", Set.of("park")),
    ATTRACTION("attraction", "tourism", Set.of("museum", "attraction", "gallery", "zoo", "viewpoint"));

    private final String apiName;
    private final String osmKey;
    private final Set<String> osmValues;

    // Binds the API name to the OpenStreetMap key and the values that count for it.
    PlaceCategory(String apiName, String osmKey, Set<String> osmValues) {
        this.apiName = apiName;
        this.osmKey = osmKey;
        this.osmValues = osmValues;
    }

    // Lowercase name used in the API and stored in places.category, e.g. "fast_food".
    public String apiName() {
        return apiName;
    }

    // OpenStreetMap key this category is read from, e.g. "amenity".
    public String osmKey() {
        return osmKey;
    }

    // OpenStreetMap values of that key that belong to this category.
    public Set<String> osmValues() {
        return osmValues;
    }

    // Finds the category for an API name ("cafe"), ignoring case.
    public static Optional<PlaceCategory> fromApiName(String name) {
        if (name == null) {
            return Optional.empty();
        }
        return Arrays.stream(values()).filter(c -> c.apiName.equalsIgnoreCase(name.trim())).findFirst();
    }

    /**
     * Picks the category for a place from its OpenStreetMap tags, or empty if none match.
     * Order matters: amenity first, then shop, leisure, tourism — so a church tagged
     * amenity=place_of_worship + tourism=attraction becomes an attraction.
     */
    public static Optional<PlaceCategory> fromOsmTags(Map<String, String> tags) {
        if (tags == null) {
            return Optional.empty();
        }
        for (PlaceCategory category : values()) {
            String value = tags.get(category.osmKey);
            if (value != null && category.osmValues.contains(value)) {
                return Optional.of(category);
            }
        }
        return Optional.empty();
    }
}
