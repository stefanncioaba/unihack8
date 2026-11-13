package com.unihack8.backend.places.service;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.unihack8.backend.places.config.PlaceImportRunner;
import org.junit.jupiter.api.Test;
import org.springframework.boot.DefaultApplicationArguments;

/** The startup runner runs the import once and never crashes the app when it fails. */
class PlaceImportRunnerTest {

    private final PlaceImportService service = mock(PlaceImportService.class);
    private final PlaceImportRunner runner = new PlaceImportRunner(service);

    // A successful import is simply run.
    @Test
    void runsImport() {
        when(service.importPlaces()).thenReturn(new PlaceImportService.Result(9, 8, 0, 1, 0));

        runner.run(new DefaultApplicationArguments());

        verify(service).importPlaces();
    }

    // A failing import (e.g. Overpass down) is logged, not thrown.
    @Test
    void failureIsNotFatal() {
        when(service.importPlaces()).thenThrow(new IllegalStateException("Overpass down"));

        assertThatCode(() -> runner.run(new DefaultApplicationArguments())).doesNotThrowAnyException();
    }
}
