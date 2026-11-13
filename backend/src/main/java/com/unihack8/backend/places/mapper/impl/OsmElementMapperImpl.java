package com.unihack8.backend.places.mapper.impl;

import com.unihack8.backend.places.client.dto.OverpassElement;
import com.unihack8.backend.places.domain.OsmPlaceData;
import com.unihack8.backend.places.domain.PlaceCategory;
import com.unihack8.backend.places.mapper.OsmElementMapper;
import java.util.Map;
import java.util.Optional;
import org.springframework.stereotype.Component;

/**
 * Mapping rules: osmId = "type/id"; position from lat/lon (nodes) or center (ways, relations);
 * category from the tags; name from "name", except unnamed ATMs become "&lt;operator or brand&gt; ATM";
 * address = "street number".
 */
@Component
public class OsmElementMapperImpl implements OsmElementMapper {

    // Applies the rules above; empty means "skip this element".
    @Override
    public Optional<OsmPlaceData> toPlaceData(OverpassElement element) {
        if (element == null || element.type() == null) {
            return Optional.empty();
        }
        double[] position = position(element);
        if (position == null) {
            return Optional.empty();
        }
        Map<String, String> tags = element.tags();
        Optional<PlaceCategory> category = PlaceCategory.fromOsmTags(tags);
        if (category.isEmpty()) {
            return Optional.empty();
        }
        String name = name(tags, category.get());
        if (name == null) {
            return Optional.empty();
        }
        return Optional.of(new OsmPlaceData(
                element.type() + "/" + element.id(),
                name,
                category.get(),
                position[0],
                position[1],
                address(tags),
                blankToNull(tags.get("opening_hours")),
                tags));
    }

    // {lat, lon} from the node itself or the way/relation centre, or null if neither is there.
    private static double[] position(OverpassElement element) {
        if (element.lat() != null && element.lon() != null) {
            return new double[] {element.lat(), element.lon()};
        }
        OverpassElement.Center center = element.center();
        if (center != null && center.lat() != null && center.lon() != null) {
            return new double[] {center.lat(), center.lon()};
        }
        return null;
    }

    // The "name" tag; unnamed ATMs get a name from the bank, other unnamed places are skipped (null).
    private static String name(Map<String, String> tags, PlaceCategory category) {
        String name = blankToNull(tags.get("name"));
        if (name != null) {
            return name;
        }
        if (category == PlaceCategory.ATM) {
            String bank = blankToNull(tags.get("operator"));
            if (bank == null) {
                bank = blankToNull(tags.get("brand"));
            }
            return bank == null ? "ATM" : bank + " ATM";
        }
        return null;
    }

    // "addr:street addr:housenumber", the street alone, or null when there is no street.
    private static String address(Map<String, String> tags) {
        String street = blankToNull(tags.get("addr:street"));
        if (street == null) {
            return null;
        }
        String number = blankToNull(tags.get("addr:housenumber"));
        return number == null ? street : street + " " + number;
    }

    // Trimmed value, or null when missing or blank.
    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
