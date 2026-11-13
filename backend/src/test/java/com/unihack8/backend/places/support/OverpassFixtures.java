package com.unihack8.backend.places.support;

import com.unihack8.backend.places.client.dto.OverpassResponse;
import com.unihack8.backend.places.client.impl.OverpassClientImpl;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import org.springframework.core.io.ClassPathResource;

/** Loads the real Overpass answer saved in src/test/resources/overpass (no network in tests). */
public final class OverpassFixtures {

    public static final String TIMISOARA_SAMPLE = "overpass/timisoara-sample.json";

    // Utility class.
    private OverpassFixtures() {
    }

    // Raw JSON text of a fixture file.
    public static String json(String path) {
        try {
            return new ClassPathResource(path).getContentAsString(StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    // The 9-element Timisoara sample, parsed exactly like the real client does.
    public static OverpassResponse timisoaraSample() {
        return OverpassClientImpl.parse(json(TIMISOARA_SAMPLE));
    }
}
