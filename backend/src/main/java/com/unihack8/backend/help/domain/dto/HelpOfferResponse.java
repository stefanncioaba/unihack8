package com.unihack8.backend.help.domain.dto;

import com.unihack8.backend.events.domain.dto.UserSummary;
import com.unihack8.backend.users.domain.dto.SkillResponse;
import java.time.Instant;
import java.util.List;

/**
 * One offer on a help request's detail page, so the requester can choose whom to trust. The helper's
 * skills (PLAN 28) come with it; the app highlights the ones in the request's category.
 */
public record HelpOfferResponse(UserSummary user, String status, Instant offeredAt, List<SkillResponse> skills) {
}
