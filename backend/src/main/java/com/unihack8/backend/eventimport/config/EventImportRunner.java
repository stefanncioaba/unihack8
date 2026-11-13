package com.unihack8.backend.eventimport.config;

import com.unihack8.backend.eventimport.service.EventImportService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * Runs the LiveTickets import once at startup when started with
 * {@code --events.import.enabled=true} (see DOCS.md → Events import). A failed import is logged
 * and the app keeps running with the events it already has.
 */
@Component
@ConditionalOnProperty(prefix = "events.import", name = "enabled", havingValue = "true")
public class EventImportRunner implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(EventImportRunner.class);

    private final EventImportService importService;

    // Needs the import service.
    public EventImportRunner(EventImportService importService) {
        this.importService = importService;
    }

    // Runs the import once; never stops the application.
    @Override
    public void run(ApplicationArguments args) {
        log.info("Events import enabled: downloading upcoming events from LiveTickets...");
        try {
            log.info("Events import finished: {}", importService.importEvents());
        } catch (RuntimeException e) {
            log.error("Events import failed; existing events were kept", e);
        }
    }
}
