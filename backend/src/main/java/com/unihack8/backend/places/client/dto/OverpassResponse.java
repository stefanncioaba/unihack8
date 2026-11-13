package com.unihack8.backend.places.client.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.util.List;

/**
 * Body of an Overpass API JSON answer. Only "elements" is read; version, generator, osm3s... are ignored.
 *
 * @param elements the OpenStreetMap nodes, ways and relations that matched the query
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public record OverpassResponse(List<OverpassElement> elements) {

    // Never null, so callers can loop without checks.
    public OverpassResponse {
        elements = elements == null ? List.of() : List.copyOf(elements);
    }
}
