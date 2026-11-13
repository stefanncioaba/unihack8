package com.unihack8.backend.reliability.service;

import com.unihack8.backend.reliability.domain.dto.ReliabilityResponse;
import java.util.UUID;

/** A user's reliability score and its history (PLAN 6.4). */
public interface ReliabilityService {

    // Current score and the 20 most recent changes; 404 NOT_FOUND for an unknown user.
    ReliabilityResponse history(UUID userId);
}
