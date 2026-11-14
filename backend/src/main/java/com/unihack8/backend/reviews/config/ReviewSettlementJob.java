package com.unihack8.backend.reviews.config;

import com.unihack8.backend.reviews.service.ReviewSettlementService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;

/**
 * Settles finished events' ratings into organiser scores every 5 minutes. On by default; set
 * {@code reviews.settlement-job.enabled=false} to turn it off (the tests do and call the service directly).
 */
@Configuration
@EnableScheduling
@ConditionalOnProperty(prefix = "reviews.settlement-job", name = "enabled", havingValue = "true", matchIfMissing = true)
public class ReviewSettlementJob {
    private static final Logger log = LoggerFactory.getLogger(ReviewSettlementJob.class);

    private final ReviewSettlementService settlements;

    // Needs the settlement service.
    public ReviewSettlementJob(ReviewSettlementService settlements) {
        this.settlements = settlements;
    }

    // First run two minutes after startup, then 5 minutes after each run; errors are logged, not thrown.
    @Scheduled(initialDelayString = "${reviews.settlement-job.initial-delay:PT2M}",
            fixedDelayString = "${reviews.settlement-job.interval:PT5M}")
    public void run() {
        try {
            settlements.settleDueEvents();
        } catch (RuntimeException e) {
            log.error("Review settlement job failed; it will try again at the next run", e);
        }
    }
}
