package com.unihack8.backend.reliability.config;

import com.unihack8.backend.reliability.service.NoShowService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;

/**
 * Runs the no-show check every 5 minutes while the backend is running (PLAN 6.3). On by default;
 * set {@code reliability.no-show-job.enabled=false} to turn it off (the tests do).
 */
@Configuration
@EnableScheduling
@ConditionalOnProperty(prefix = "reliability.no-show-job", name = "enabled", havingValue = "true", matchIfMissing = true)
public class NoShowJob {

    private static final Logger log = LoggerFactory.getLogger(NoShowJob.class);

    private final NoShowService noShows;

    // Needs the no-show service.
    public NoShowJob(NoShowService noShows) {
        this.noShows = noShows;
    }

    // First run one minute after startup, then 5 minutes after each run ends; errors are logged, not thrown.
    @Scheduled(initialDelayString = "${reliability.no-show-job.initial-delay:PT1M}",
            fixedDelayString = "${reliability.no-show-job.interval:PT5M}")
    public void run() {
        try {
            noShows.markNoShows();
        } catch (RuntimeException e) {
            log.error("No-show job failed; it will try again at the next run", e);
        }
    }
}
