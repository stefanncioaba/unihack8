package com.unihack8.backend.reliability.service.impl;

import com.unihack8.backend.common.exception.ApiException;
import com.unihack8.backend.reliability.domain.dto.ReliabilityResponse;
import com.unihack8.backend.reliability.mapper.ReliabilityMapper;
import com.unihack8.backend.reliability.repository.CheckInRepository;
import com.unihack8.backend.reliability.service.ReliabilityService;
import com.unihack8.backend.users.domain.entity.Profile;
import com.unihack8.backend.users.repository.ProfileRepository;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Reads the score from profiles and the history from reliability_log. */
@Service
public class ReliabilityServiceImpl implements ReliabilityService {

    static final int HISTORY_LIMIT = 20;

    private final ProfileRepository profiles;
    private final CheckInRepository checkIns;
    private final ReliabilityMapper mapper;

    // Needs profiles, the log query and the mapper.
    public ReliabilityServiceImpl(ProfileRepository profiles, CheckInRepository checkIns, ReliabilityMapper mapper) {
        this.profiles = profiles;
        this.checkIns = checkIns;
        this.mapper = mapper;
    }

    // Score and the 20 newest log entries.
    @Override
    @Transactional(readOnly = true)
    public ReliabilityResponse history(UUID userId) {
        Profile profile = profiles.findById(userId).orElseThrow(() -> ApiException.notFound("User"));
        return mapper.toResponse(profile.getReliabilityScore(), checkIns.recentLog(userId, HISTORY_LIMIT));
    }
}
