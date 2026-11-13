package com.unihack8.backend.places.mapper.impl;

import com.unihack8.backend.places.domain.dto.PlaceDetailDto;
import com.unihack8.backend.places.domain.dto.PlaceSummaryDto;
import com.unihack8.backend.places.domain.entity.Place;
import com.unihack8.backend.places.mapper.PlaceMapper;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Component;

/** Hand-written PlaceMapper. */
@Component
public class PlaceMapperImpl implements PlaceMapper {

    /**
     * OpenStreetMap tags shown in place details, in this order. Everything else stays in the
     * database (the AI can still use it) but is not sent to the app.
     */
    static final List<String> PUBLIC_TAGS = List.of(
            "cuisine", "website", "contact:website", "phone", "contact:phone", "email",
            "wheelchair", "outdoor_seating", "takeaway", "delivery",
            "diet:vegetarian", "diet:vegan", "brand", "operator", "description");

    // Copies the list fields and the optional distance.
    @Override
    public PlaceSummaryDto toSummary(Place place, Integer distanceMeters) {
        return new PlaceSummaryDto(
                place.getId(),
                place.getOsmId(),
                place.getName(),
                place.getCategory().apiName(),
                place.getLat(),
                place.getLon(),
                place.getAddress(),
                distanceMeters);
    }

    // Copies all detail fields and keeps only the public tags that are present.
    @Override
    public PlaceDetailDto toDetail(Place place) {
        Map<String, String> tags = new LinkedHashMap<>();
        Map<String, String> all = place.getTags() == null ? Map.of() : place.getTags();
        for (String key : PUBLIC_TAGS) {
            String value = all.get(key);
            if (value != null && !value.isBlank()) {
                tags.put(key, value);
            }
        }
        return new PlaceDetailDto(
                place.getId(),
                place.getOsmId(),
                place.getName(),
                place.getCategory().apiName(),
                place.getLat(),
                place.getLon(),
                place.getAddress(),
                place.getOpeningHours(),
                tags);
    }
}
