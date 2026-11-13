package com.unihack8.backend.places.domain.dto;

import java.util.List;

/**
 * A place with its distance and stored prices, as given to the AI assistant (PLAN 11.2, 11.3).
 *
 * @param distanceMeters distance from the search point
 * @param prices         stored prices (filtered by item type when the search asked for one), cheapest first
 */
public record PlaceInsightDto(PlaceDetailDto place, int distanceMeters, List<PriceDto> prices) {
}
