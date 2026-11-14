package com.unihack8.backend.neighbourhoods.domain.dto;

import java.util.List;

/**
 * Places in an area and how many are open right now (from OpenStreetMap opening hours).
 *
 * @param total         places in the area
 * @param openNow       places whose opening hours say they are open now
 * @param topCategories categories with the most open places, most first (at most 3)
 */
public record PulsePlacesDto(int total, int openNow, List<String> topCategories) {
}
