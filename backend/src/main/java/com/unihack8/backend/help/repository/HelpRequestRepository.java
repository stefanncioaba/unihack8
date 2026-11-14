package com.unihack8.backend.help.repository;

import com.unihack8.backend.common.geo.BoundingBox;
import com.unihack8.backend.help.domain.entity.HelpRequest;
import com.unihack8.backend.help.domain.entity.HelpRequestView;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** Storage of help_requests. Status changes are conditional on OPEN, so two racing calls change it once. */
public interface HelpRequestRepository {

    // Saves a new request.
    void insert(HelpRequest request);

    // One request with requester, offer count and the caller's offer (caller may be null).
    Optional<HelpRequestView> findView(UUID id, UUID caller);

    // Locks the request row until the transaction ends (offer, withdraw, cancel and scan are serialised).
    Optional<HelpRequest> lock(UUID id);

    // Open requests that have not expired at `now`, newest first; with a bbox (may be null) only those inside it.
    List<HelpRequestView> openRequests(Instant now, UUID caller, BoundingBox bbox, int limit);

    // Requests posted by the user, newest first, every status.
    List<HelpRequestView> requestedBy(UUID userId, int limit);

    // Requests the user offered on (not withdrawn), newest first, every status.
    List<HelpRequestView> offeredBy(UUID userId, int limit);

    // OPEN -> CANCELLED; returns the number of rows changed (0 when no longer open).
    int cancel(UUID id, Instant closedAt);

    // OPEN -> HELPED with the scanned helper; returns the number of rows changed.
    int close(UUID id, UUID helperId, Instant closedAt);
}
