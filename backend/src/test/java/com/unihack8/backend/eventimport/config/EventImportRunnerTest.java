package com.unihack8.backend.eventimport.config;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.unihack8.backend.eventimport.service.EventImportService;
import org.junit.jupiter.api.Test;
import org.springframework.boot.DefaultApplicationArguments;

/** The startup runner imports once and never crashes the app. */
class EventImportRunnerTest {

    // Runs the import once.
    @Test
    void runsTheImport() {
        EventImportService service = mock(EventImportService.class);
        when(service.importEvents()).thenReturn(new EventImportService.Result(1, 1, 1, 0, 1, 0, 0));

        new EventImportRunner(service).run(new DefaultApplicationArguments());

        verify(service).importEvents();
    }

    // A failing import (e.g. LiveTickets down) is logged, not thrown.
    @Test
    void failureDoesNotStopTheApp() {
        EventImportService service = mock(EventImportService.class);
        when(service.importEvents()).thenThrow(new IllegalStateException("LiveTickets is down"));

        assertThatCode(() -> new EventImportRunner(service).run(new DefaultApplicationArguments()))
                .doesNotThrowAnyException();
    }
}
