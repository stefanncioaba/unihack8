package com.unihack8.backend.places.service.impl;

import com.unihack8.backend.common.geo.BoundingBox;
import com.unihack8.backend.places.domain.dto.PlaceSearchCriteria;
import com.unihack8.backend.places.domain.entity.Place;
import java.util.Locale;
import org.springframework.data.jpa.domain.Specification;

/** Database filters for place search, combined with AND. */
final class PlaceSpecifications {

    // Utility class.
    private PlaceSpecifications() {
    }

    // All filters from the criteria except "near" (handled by the service).
    static Specification<Place> matching(PlaceSearchCriteria criteria) {
        Specification<Place> spec = Specification.unrestricted();
        if (!criteria.categories().isEmpty()) {
            spec = spec.and((root, query, cb) -> root.get("category").in(criteria.categories()));
        }
        if (criteria.bbox() != null) {
            spec = spec.and(inBox(criteria.bbox()));
        }
        if (criteria.query() != null) {
            String pattern = "%" + escapeLike(criteria.query().toLowerCase(Locale.ROOT)) + "%";
            spec = spec.and((root, query, cb) -> cb.like(cb.lower(root.get("name")), pattern, '\\'));
        }
        return spec;
    }

    // Places whose coordinates lie inside the box.
    static Specification<Place> inBox(BoundingBox box) {
        return (root, query, cb) -> cb.and(
                cb.between(root.get("lat"), box.minLat(), box.maxLat()),
                cb.between(root.get("lon"), box.minLon(), box.maxLon()));
    }

    // Makes % and _ in user input match literally.
    private static String escapeLike(String text) {
        return text.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
    }
}
