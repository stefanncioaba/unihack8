package com.unihack8.backend.reliability.service.impl;

import com.unihack8.backend.events.repository.ParticipationRepository;
import com.unihack8.backend.reliability.domain.ReliabilityRules;
import com.unihack8.backend.reliability.domain.entity.OverdueParticipant;
import com.unihack8.backend.reliability.repository.CheckInRepository;
import com.unihack8.backend.reliability.service.NoShowService;
import java.time.Clock;
import java.time.Instant;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Each participant is handled in its own short transaction: the status change is conditional on
 * JOINED, and the -10 is applied only when that change happened, so running twice (or alongside a
 * late check-in) never double-penalises.
 */
@Service
public class NoShowServiceImpl implements NoShowService {

    private static final Logger log = LoggerFactory.getLogger(NoShowServiceImpl.class);

    private final CheckInRepository checkIns;
    private final ParticipationRepository participations;
    private final TransactionTemplate transaction;
    private final Clock clock;

    // Needs the check-in SQL, the shared score update, transactions and the clock.
    public NoShowServiceImpl(CheckInRepository checkIns, ParticipationRepository participations,
                             PlatformTransactionManager transactionManager, Clock clock) {
        this.checkIns = checkIns;
        this.participations = participations;
        this.transaction = new TransactionTemplate(transactionManager);
        this.clock = clock;
    }

    // Finds JOINED participants of user events that are over and marks each as NO_SHOW with -10.
    @Override
    public int markNoShows() {
        Instant now = clock.instant();
        int marked = 0;
        for (OverdueParticipant p : checkIns.joinedInStartedEvents(now)) {
            if (now.isBefore(ReliabilityRules.effectiveEnd(p.startsAt(), p.endsAt()))) {
                continue;
            }
            Boolean changed = transaction.execute(status -> {
                if (checkIns.markNoShow(p.eventId(), p.userId()) == 0) {
                    return false;
                }
                participations.changeReliability(p.userId(), p.eventId(), ReliabilityRules.NO_SHOW_POINTS,
                        ReliabilityRules.NO_SHOW_REASON, now);
                return true;
            });
            if (Boolean.TRUE.equals(changed)) {
                marked++;
            }
        }
        if (marked > 0) {
            log.info("No-show job: {} participant(s) marked NO_SHOW ({} points each)", marked,
                    ReliabilityRules.NO_SHOW_POINTS);
        }
        return marked;
    }
}
