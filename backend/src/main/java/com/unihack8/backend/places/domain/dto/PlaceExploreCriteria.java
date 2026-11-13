package com.unihack8.backend.places.domain.dto;

import com.unihack8.backend.common.geo.GeoPoint;
import com.unihack8.backend.places.domain.PlaceCategory;
import com.unihack8.backend.places.domain.PriceItemType;
import java.util.Set;

/**
 * Filters for the AI assistant's place search (PLAN 11.2): richer than GET /places because it
 * also looks at cuisine/brand tags and stored prices.
 *
 * @param categories     wanted categories; empty = all
 * @param keyword        word to find in the name, cuisine, brand or description; null = any
 * @param near           point to measure distance from (required)
 * @param radiusMeters   max distance from near
 * @param priceItemType  only consider prices of this type (and sort by them when sortByPrice); null = all
 * @param onlyWithPrices drop places that have no stored price (of priceItemType, when set)
 * @param sortByPrice    cheapest first (places without a price last), otherwise closest first
 * @param limit          max results
 */
public record PlaceExploreCriteria(
        Set<PlaceCategory> categories,
        String keyword,
        GeoPoint near,
        int radiusMeters,
        PriceItemType priceItemType,
        boolean onlyWithPrices,
        boolean sortByPrice,
        int limit) {

    // Normalises null categories to an empty set and blank keywords to null.
    public PlaceExploreCriteria {
        categories = categories == null ? Set.of() : Set.copyOf(categories);
        keyword = keyword == null || keyword.isBlank() ? null : keyword.trim();
        if (near == null) {
            throw new IllegalArgumentException("near is required");
        }
    }
}
