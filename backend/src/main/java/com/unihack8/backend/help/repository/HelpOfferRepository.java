package com.unihack8.backend.help.repository;

import com.unihack8.backend.help.domain.entity.HelpOffer;
import com.unihack8.backend.help.domain.entity.HelpOfferView;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** Storage of help_offers (who offered to help, and their QR token). */
public interface HelpOfferRepository {

    // The user's offer on a request, in any status.
    Optional<HelpOffer> find(UUID requestId, UUID helperId);

    // One offer by its unique QR token.
    Optional<HelpOffer> findByToken(UUID qrToken);

    // Saves a new offer.
    void insert(HelpOffer offer);

    // Changes the status only when it is currently `from`; returns the number of rows changed.
    int changeStatus(UUID requestId, UUID helperId, String from, String to);

    // OFFERED -> HELPED with the scan time; returns the number of rows changed.
    int markHelped(UUID requestId, UUID helperId, Instant checkedInAt);

    // Every other OFFERED offer on the request -> NOT_NEEDED (no points change).
    int markOthersNotNeeded(UUID requestId, UUID helperId);

    // Offers except withdrawn ones, oldest first, with each helper's username and score.
    List<HelpOfferView> offers(UUID requestId);
}
