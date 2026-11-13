package com.unihack8.backend.eventimport.service.impl;

import com.unihack8.backend.common.geo.GeoPoint;
import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.function.Function;

/**
 * Hand-curated venues from src/main/resources/eventimport/venues.txt: venue name -> street address or
 * exact "lat,lon". Covers venues OpenStreetMap does not know by name (PLAN 7.3).
 */
final class VenueDirectory {

    static final String RESOURCE = "/eventimport/venues.txt";

    /**
     * What the file says about a venue.
     *
     * @param point   exact coordinates when the line gave "lat,lon", otherwise null
     * @param address street address to geocode when the line gave an address, otherwise null
     */
    record Entry(GeoPoint point, String address) {
    }

    private final Map<String, Entry> entries;

    // Builds the directory from parsed entries keyed by normalized venue name.
    private VenueDirectory(Map<String, Entry> entries) {
        this.entries = entries;
    }

    // Loads the bundled venues.txt (empty directory if the file is missing).
    static VenueDirectory load(Function<String, String> normalize) {
        try (InputStream in = VenueDirectory.class.getResourceAsStream(RESOURCE)) {
            if (in == null) {
                return new VenueDirectory(Map.of());
            }
            return parse(new String(in.readAllBytes(), StandardCharsets.UTF_8), normalize);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    // Parses "name | address" and "name | lat,lon" lines; comments, blank and malformed lines are skipped.
    static VenueDirectory parse(String text, Function<String, String> normalize) {
        Map<String, Entry> entries = new HashMap<>();
        try (BufferedReader reader = new BufferedReader(new java.io.StringReader(text))) {
            String line;
            while ((line = reader.readLine()) != null) {
                String trimmed = line.strip();
                int bar = trimmed.indexOf('|');
                if (trimmed.isEmpty() || trimmed.startsWith("#") || bar <= 0) {
                    continue;
                }
                String name = normalize.apply(trimmed.substring(0, bar));
                String value = trimmed.substring(bar + 1).strip();
                if (!name.isEmpty() && !value.isEmpty()) {
                    entries.put(name, toEntry(value));
                }
            }
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
        return new VenueDirectory(Map.copyOf(entries));
    }

    // The entry for one of these normalized names (first that exists), if any.
    Optional<Entry> find(Iterable<String> normalizedNames) {
        for (String name : normalizedNames) {
            Entry entry = entries.get(name);
            if (entry != null) {
                return Optional.of(entry);
            }
        }
        return Optional.empty();
    }

    // "45.75,21.23" becomes exact coordinates; anything else is an address.
    private static Entry toEntry(String value) {
        String[] parts = value.split(",");
        if (parts.length == 2) {
            try {
                return new Entry(new GeoPoint(Double.parseDouble(parts[0].trim()), Double.parseDouble(parts[1].trim())), null);
            } catch (IllegalArgumentException notCoordinates) {
                // Not two numbers (or out of range): treat as an address.
            }
        }
        return new Entry(null, value);
    }
}
