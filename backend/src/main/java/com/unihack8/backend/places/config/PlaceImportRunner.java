package com.unihack8.backend.places.config;

import com.unihack8.backend.places.service.PlaceImportService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Runs the OpenStreetMap import once at startup when places.import.enabled=true, e.g.
 * ./gradlew bootRun --args='--spring.profiles.active=local --places.import.enabled=true'.
 * A failed import is logged; the server keeps running with the places it already has.
 */
@Component
@ConditionalOnProperty(prefix = "places.import", name = "enabled", havingValue = "true")
public class PlaceImportRunner implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(PlaceImportRunner.class);

    private final PlaceImportService placeImportService;

    // Gets the import service.
    public PlaceImportRunner(PlaceImportService placeImportService) {
        this.placeImportService = placeImportService;
    }

    // Starts the import and logs the result or the failure.
    @Override
    public void run(ApplicationArguments args) {
        log.info("Places import enabled: downloading places from OpenStreetMap (Overpass)...");
        try {
            PlaceImportService.Result result = placeImportService.importPlaces();
            log.info("Places import finished: {}", result);
        } catch (RuntimeException e) {
            log.error("Places import failed; existing places were kept", e);
        }
    }
}
