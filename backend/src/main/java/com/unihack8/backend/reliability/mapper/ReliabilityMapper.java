package com.unihack8.backend.reliability.mapper;

import com.unihack8.backend.reliability.domain.dto.ReliabilityResponse;
import com.unihack8.backend.reliability.domain.entity.ReliabilityLogEntry;
import java.util.List;

/** Builds the reliability API shapes from log rows. */
public interface ReliabilityMapper {

    // Score plus the given log rows as API entries (same order).
    ReliabilityResponse toResponse(int reliabilityScore, List<ReliabilityLogEntry> entries);
}
