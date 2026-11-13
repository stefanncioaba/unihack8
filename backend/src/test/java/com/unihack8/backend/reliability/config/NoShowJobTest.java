package com.unihack8.backend.reliability.config;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.unihack8.backend.reliability.service.NoShowService;
import org.junit.jupiter.api.Test;

/** The scheduled wrapper runs the service and never lets an error kill the scheduler. */
class NoShowJobTest {

    // Each run calls the service.
    @Test
    void runCallsTheService() {
        NoShowService service = mock(NoShowService.class);
        new NoShowJob(service).run();
        verify(service).markNoShows();
    }

    // A database error is logged, not thrown.
    @Test
    void failureIsSwallowed() {
        NoShowService service = mock(NoShowService.class);
        when(service.markNoShows()).thenThrow(new IllegalStateException("database down"));
        assertThatCode(() -> new NoShowJob(service).run()).doesNotThrowAnyException();
    }
}
