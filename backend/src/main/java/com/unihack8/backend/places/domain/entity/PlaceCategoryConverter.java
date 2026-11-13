package com.unihack8.backend.places.domain.entity;

import com.unihack8.backend.places.domain.PlaceCategory;
import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

/** Stores PlaceCategory as its lowercase API name ("fast_food") in places.category. */
@Converter
public class PlaceCategoryConverter implements AttributeConverter<PlaceCategory, String> {

    // Enum -> column value.
    @Override
    public String convertToDatabaseColumn(PlaceCategory category) {
        return category == null ? null : category.apiName();
    }

    // Column value -> enum; fails loudly on a value no category knows.
    @Override
    public PlaceCategory convertToEntityAttribute(String value) {
        if (value == null) {
            return null;
        }
        return PlaceCategory.fromApiName(value)
                .orElseThrow(() -> new IllegalStateException("Unknown place category in database: " + value));
    }
}
