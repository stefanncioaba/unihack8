package com.unihack8.backend.places.mapper;

import com.unihack8.backend.places.domain.dto.PlaceDetailDto;
import com.unihack8.backend.places.domain.dto.PlaceSummaryDto;
import com.unihack8.backend.places.domain.entity.Place;

/** Converts Place entities into the API shapes from docs/API.md. */
public interface PlaceMapper {

    // List/map shape; distanceMeters may be null.
    PlaceSummaryDto toSummary(Place place, Integer distanceMeters);

    // Detail shape with opening hours and the useful OpenStreetMap tags.
    PlaceDetailDto toDetail(Place place);
}
