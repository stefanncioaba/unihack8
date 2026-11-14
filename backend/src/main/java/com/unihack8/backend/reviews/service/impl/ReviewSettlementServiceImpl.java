package com.unihack8.backend.reviews.service.impl;

import com.unihack8.backend.events.repository.ParticipationRepository;
import com.unihack8.backend.reviews.domain.ReviewRules;
import com.unihack8.backend.reviews.domain.dto.RatingStats;
import com.unihack8.backend.reviews.domain.entity.SettlementCandidate;
import com.unihack8.backend.reviews.repository.ReviewRepository;
import com.unihack8.backend.reviews.service.ReviewSettlementService;
import java.time.Clock;
import java.time.Instant;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Once an event's review window (end + 24 h) is over, its average rating moves the organiser's
 * reliability score: above 3 stars gains up to +5, 3 stars or less loses up to -5, no reviews changes
 * nothing. Each event is settled in its own transaction; the conditional markSettled makes repeated or
 * overlapping runs apply the points only once.
 */
@Service
public class ReviewSettlementServiceImpl implements ReviewSettlementService {
    private static final Logger log = LoggerFactory.getLogger(ReviewSettlementServiceImpl.class);

    private final ReviewRepository reviews;
    private final ParticipationRepository participations;
    private final TransactionTemplate transaction;
    private final Clock clock;

    // Needs review storage, the shared reliability update, transactions and the clock.
    public ReviewSettlementServiceImpl(ReviewRepository reviews, ParticipationRepository participations,
            PlatformTransactionManager transactionManager, Clock clock) {
        this.reviews = reviews;
        this.participations = participations;
        this.transaction = new TransactionTemplate(transactionManager);
        this.clock = clock;
    }

    // Settles every due event; events without reviews are only marked settled.
    @Override
    public int settleDueEvents() {
        Instant now = clock.instant();
        int changed = 0;
        for (SettlementCandidate c : reviews.unsettledStartedBefore(now)) {
            if (now.isBefore(ReviewRules.closesAt(c.startsAt(), c.endsAt()))) {
                continue;
            }
            Boolean applied = transaction.execute(status -> {
                if (reviews.markSettled(c.eventId(), now) == 0) {
                    return false;
                }
                RatingStats stats = reviews.stats(c.eventId());
                if (stats.count() == 0 || c.organizerId() == null) {
                    return false;
                }
                participations.changeReliability(c.organizerId(), c.eventId(),
                        ReviewRules.ratingPoints(stats.average()), ReviewRules.RATING_REASON, now);
                return true;
            });
            if (Boolean.TRUE.equals(applied)) {
                changed++;
            }
        }
        if (changed > 0) {
            log.info("Review settlement: {} organiser score(s) changed from event ratings", changed);
        }
        return changed;
    }
}
