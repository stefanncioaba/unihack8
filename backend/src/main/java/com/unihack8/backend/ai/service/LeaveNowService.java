package com.unihack8.backend.ai.service;

import com.unihack8.backend.ai.domain.dto.LeaveNowDto;
import com.unihack8.backend.routing.domain.dto.RoutePlanResponse;
import java.time.Instant;
import java.util.Optional;

/** "Leave now" / "Will I make it?": when to leave to catch the first ride of a route, from STPT live arrivals. */
public interface LeaveNowService {

    // Empty when the route has no public transport ride; otherwise the vehicle to catch and when to leave.
    Optional<LeaveNowDto> leaveNow(RoutePlanResponse plan, Instant now);
}
