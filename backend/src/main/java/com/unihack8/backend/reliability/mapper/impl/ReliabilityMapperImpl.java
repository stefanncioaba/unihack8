package com.unihack8.backend.reliability.mapper.impl;

import com.unihack8.backend.reliability.domain.dto.ReliabilityResponse;
import com.unihack8.backend.reliability.domain.entity.ReliabilityLogEntry;
import com.unihack8.backend.reliability.mapper.ReliabilityMapper;
import java.util.List;
import org.springframework.stereotype.Component;

/** Hand-written ReliabilityMapper. */
@Component
public class ReliabilityMapperImpl implements ReliabilityMapper {

    // Copies each log row field by field.
    @Override
    public ReliabilityResponse toResponse(int reliabilityScore, List<ReliabilityLogEntry> entries) {
        return new ReliabilityResponse(reliabilityScore, entries.stream()
                .map(e -> new ReliabilityResponse.Entry(e.pointsChange(), e.reason(), e.eventId(), e.eventTitle(),
                        e.createdAt()))
                .toList());
    }
}
