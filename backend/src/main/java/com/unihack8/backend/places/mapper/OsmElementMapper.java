package com.unihack8.backend.places.mapper;

import com.unihack8.backend.places.client.dto.OverpassElement;
import com.unihack8.backend.places.domain.OsmPlaceData;
import java.util.Optional;

/** Turns raw Overpass elements into place data for the import (PLAN 8.2). */
public interface OsmElementMapper {

    // Place data for the element, or empty when it has no position, no app category or no usable name.
    Optional<OsmPlaceData> toPlaceData(OverpassElement element);
}
